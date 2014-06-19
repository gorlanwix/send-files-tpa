'use strict';

var userAuth = require('./controllers/user-auth.js');
var db = require('./controllers/pg-database.js');
var upload = require('./controllers/upload-files.js');
var email = require('./controllers/email.js');

var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var validator = require('validator');
var fs = require('fs');
var wix = require('wix');
var httpStatus = require('http-status');

var app = express();
var router = express.Router();

wix.secret(require('./connect-keys/wix-key.json').secretKey);
app.use(bodyParser());
app.use(express.static(__dirname));

var MAX_FILE_SIZE = 1073741824;

app.use(multer({
  dest: './tmp/',
  limits: {
    fileSize: MAX_FILE_SIZE,
  }
}));


// parse instance and sets parsed insatnceId
function WixWidget(instance, compId) {

  if (instance === 'whatever') { // for testing purposes
    this.instanceId = instance;
  } else {
    var parsedInstance = wix.parse(instance);
    if (!parsedInstance) {
      throw new Error('invalid instance');
    }
    this.instanceId = parsedInstance.instanceId;
  }
  this.compId = compId;
}

function Visitor(name, email, message) {
  this.name = name;
  this.email = email;
  this.message = message;
}

// set any param to null to avoid it's update
function WidgetSettings(userEmail, provider, settings) {
  this.userEmail = userEmail;
  this.provider = provider;
  this.settings = settings;
}


function error(message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
}


app.get('/auth/callback/google', function (req, res, next) {
  if (req.query.error) {
    res.redirect('/');
    return;
  }
  userAuth.exchangeCodeForTokens(req.query.code, function (err, tokens) {
    console.log('tokens from google: ', tokens);
    console.log('oauth2callback state: ', req.query.state);

    var wixIds = req.query.state.split('+');
    var currInstance = new WixWidget(wixIds[0], wixIds[1]);

    var provider = 'google';

    db.token.insert(currInstance, tokens, provider, function (err) {
      userAuth.getWidgetEmail(tokens, function (err, widgetEmail) {
        var widgetSettings = new WidgetSettings(widgetEmail || '', provider, null);
        db.widget.getSettings(currInstance, function (err, widgetSettingsFromDb) {
          if (widgetSettingsFromDb) {
            var isEmailSet = widgetSettingsFromDb.user_email !== '';
            // do not update if email already set
            if (isEmailSet) { widgetSettings.userEmail = null; }
            db.widget.updateSettings(currInstance, widgetSettings, function (err) {

              res.redirect('/');
            });
          } else {
            widgetSettings.settings = null;
            db.widget.insertSettings(currInstance, widgetSettings, function (err) {

              res.redirect('/');
            });
          }
        });
      });
    });
  });
});


app.use('/api', function (req, res, next) {

  var instance = req.header('X-Wix-Instance');

  var currInstance;
  try {
    currInstance = new WixWidget(instance, null);
  } catch (e) {
    return next(error('invalid instance', httpStatus.UNAUTHORIZED));
  }

  req.widgetIds = currInstance;
  next();
});

app.param('compId', function (req, res, next, compId) {
  if (!compId) {
    next(error('invalid component ID', httpStatus.UNAUTHORIZED));
  } else {
    req.widgetIds.compId = compId;
    next();
  }
});

app.get('/api/auth/login/google/:compId', function (req, res, next) {
  db.token.get(req.widgetIds, function (err, tokensFromDb) {
    if (!tokensFromDb) {
      userAuth.getGoogleAuthUrl(req.widgetIds, function (url) {
        res.redirect(url);
      });
    } else {
      next(error('already logged in to ' + tokensFromDb.provider, httpStatus.BAD_REQUEST));
    }
  });
});

app.get('/api/auth/logout/:compId', function (req, res, next) {

  db.token.remove(req.widgetIds, function (err, tokensFromDb) {
    console.log('removed tokens: ', tokensFromDb);
    if (!tokensFromDb) {
      return next(error('not logged in', httpStatus.BAD_REQUEST));
    }

    var widgetSettings = new WidgetSettings(null, '', null);

    db.widget.updateSettings(req.widgetIds, widgetSettings, function (err) {
      if (err) {
        return next(error('settings update error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      if (tokensFromDb.provider === 'google') {
        var oauth2Client = userAuth.createOauth2Client();
        oauth2Client.revokeToken(tokensFromDb.refresh_token, function (err, result) {
          console.log('revoked token');
          if (err) {
            console.error('token revoking error', err);
            return next(error('token revoking error', httpStatus.INTERNAL_SERVER_ERROR));
          }

          res.status(httpStatus.OK);
          res.json({status: httpStatus.OK});
        });
      }
    });
  });
});


app.get('/login', function (req, res) {
  res.sendfile('./login.html');
});


app.get('/api/files/session/:compId', function (req, res, next) {
  userAuth.getInstanceTokens(req.widgetIds, function (err, tokens) {
    if (!tokens) {
      console.error('getting instance tokens error', err);
      return next(error('widget is not signed in', httpStatus.UNAUTHORIZED));
    }
    upload.getAvailableCapacity(tokens, function (err, capacity) {
      if (err) {
        return next(error('cannot get availble capacity', httpStatus.INTERNAL_SERVER_ERROR));
      }
      db.session.open(req.widgetIds, function (err, sessionId) {

        if (err) {
          return next(error('cannot open session', httpStatus.INTERNAL_SERVER_ERROR));
        }
        var resJson = {
          sessionId: sessionId,
          capacity: capacity,
          status: httpStatus.OK
        };
        res.status(httpStatus.OK);
        res.json(resJson);
      });
    });
  });
});



app.post('/api/files/upload/:compId', function (req, res, next) {

  var MAX_FILE_SIZE = 1073741824;

  var newFile = req.files.sendFile;
  var sessionId = req.query.sessionId;

  var formatError = null;

  if (!validator.isInt(sessionId)) {
    formatError = error('invalid session format', httpStatus.BAD_REQUEST);
  }

  if (newFile.size >= MAX_FILE_SIZE) {
    formatError = error('file is too large', httpStatus.REQUEST_ENTITY_TOO_LARGE);
  }

  if (formatError) {
    fs.unlink(newFile.path, function() {
      return next(formatError);
    });
  } else {

    db.files.updateSessionAndInsert(newFile, sessionId, req.widgetIds, function (err, fileId) {
      if (!fileId) {
        return next(error('cannot insert file', httpStatus.INTERNAL_SERVER_ERROR));
      }

      var resJson = {
        status: httpStatus.OK,
        fileId: fileId
      };
      res.status(httpStatus.OK);
      res.json(resJson);
    });
  }
});

/*

JSON format

{
  "name": "kjasdfasfasdf",
  "email": "whasdfasdfs",
  "message": "asdfasfasdfasf"
  "toUpload": [
    "1",
    "2",
    "3"
  ]
}

*/

app.post('/api/files/send/:compId', function (req, res, next) {


  // parse the request

  var recievedJson = req.body;
  var sessionId = req.query.sessionId;

  if (!validator.isInt(sessionId)) {
    return next(error('invalid session format', httpStatus.BAD_REQUEST));
  }

  if (typeof recievedJson !== 'object') {
    return next(error('request body is not JSON', httpStatus.BAD_REQUEST));
  }

  var visitorEmail = recievedJson.visitorEmail;
  var visitorName = recievedJson.visitorName;
  var toUploadFileIds = recievedJson.fileIds;
  var visitorMessage = recievedJson.message;

  var isRequiredExist = visitorEmail && visitorName && toUploadFileIds && visitorMessage;

  if (!isRequiredExist) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }
  visitorEmail = visitorEmail.trim();
  visitorName = visitorName.trim();
  visitorMessage = visitorMessage.trim();

  var isValidFormat = validator.isEmail(visitorEmail) &&
                      toUploadFileIds instanceof Array &&
                      !validator.isNull(visitorName) &&
                      !validator.isNull(visitorMessage);

  if (!isValidFormat) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }

  userAuth.getInstanceTokens(req.widgetIds, function (err, tokens) {

    if (!tokens) {
      console.error('getting instance tokens error', err);
      return next(error('widget is not signed in', httpStatus.UNAUTHORIZED));
    }
    db.files.getByIds(sessionId, toUploadFileIds, function (err, files) {
      if (!files) {
        console.error('cannot find files', err);
        return next(error('cannot find files', httpStatus.BAD_REQUEST));
      }

      if (files[0].sum > MAX_FILE_SIZE) {
        return next(error('total files size is too large', httpStatus.REQUEST_ENTITY_TOO_LARGE));
      }
      upload.getAvailableCapacity(tokens, function (err, capacity) {
        if (err) {
          return next(error('cannot get availble capacity', httpStatus.INTERNAL_SERVER_ERROR));
        }

        if (capacity <= MAX_FILE_SIZE) {
          return next(error('Google Drive is full', httpStatus.BAD_REQUEST));
        }


        console.log('files to be zipped: ', files);
        var zipName = visitorName.replace(/\s+/g, '-');

        upload.zip(files, zipName, function (err, archive) {
          console.log('zipped file: ', archive);
          if (err) {
            console.log('zipping error', err);
          }
          upload.insertFile(archive, sessionId, req.widgetIds, tokens, function (err, result) {


            if (err) { console.error('uploading to google error', err); }
            result = JSON.parse(result);
            console.log('inserted file: ', result);
            var visitor = new Visitor(visitorName, visitorEmail, visitorMessage);
            email.send('andreye@wix.com', visitor, result.alternateLink, function (err) {
              console.log('sent email');
              res.status(httpStatus.ACCEPTED);
              res.json({status: httpStatus.ACCEPTED});
            });
          });
        });
      });
    });
  });
});



app.get('/api/settings/:compId', function (req, res, next) {

  db.widget.getSettings(req.widgetIds, function (err, widgetSettings) {

    var settingsResponse = {
      userEmail: '',
      provider: '',
      settings: {}
    };

    if (widgetSettings) {
      settingsResponse.userEmail = widgetSettings.user_email;
      settingsResponse.provider = widgetSettings.curr_provider;
      settingsResponse.settings = widgetSettings.settings;
    }

    res.status(httpStatus.OK);
    res.json({widgetSettings: settingsResponse, status: httpStatus.OK});
  });
});


app.put('/api/settings/:compId', function (req, res, next) {

  console.log(req.body);
  var widgetSettings = req.body.widgetSettings;
  var userEmail = widgetSettings.userEmail;
  var isValidSettings = widgetSettings && userEmail !== undefined &&
                        (userEmail.trim() === '' ||
                         validator.isEmail(userEmail)) &&
                        typeof widgetSettings.settings === 'object';

  if (!isValidSettings) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }

  var settingsRecieved = new WidgetSettings(userEmail, '', widgetSettings.settings);
  db.widget.updateSettings(req.widgetIds, settingsRecieved, function (err, updatedWidgetSettings) {
    if (!updatedWidgetSettings) {
      db.widget.insertSettings(req.widgetIds, settingsRecieved, function (err) {
        if (err) {
          console.error('cannot insert settings: ', err);
          return next(error('cannot insert settings', httpStatus.INTERNAL_SERVER_ERROR));
        }

        res.status(httpStatus.CREATED);
        res.json({status: httpStatus.CREATED});
      });
    } else {

      res.status(httpStatus.CREATED);
      res.json({status: httpStatus.CREATED});
    }
  });
});

app.use(function (err, req, res, next) {
  var errorStatus = err.status || httpStatus.INTERNAL_SERVER_ERROR;
  res.json(errorStatus, {status: errorStatus, error: err.message });
});

app.use(function (req, res) {
  res.json(httpStatus.NOT_FOUND, {status: httpStatus.NOT_FOUND, error: 'resource not found' });
});



module.exports = app;
