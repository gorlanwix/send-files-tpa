'use strict';

var userAuth = require('./controllers/user-auth.js');
var db = require('./controllers/pg-database.js');
var upload = require('./controllers/upload-files.js');
var email = require('./controllers/email.js');
var googleDrive = require('./controllers/google-drive.js');
var config = require('./config.js');

var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var validator = require('validator');
var fs = require('fs');
var httpStatus = require('http-status');
var wix = config.wix;


var MAX_FILE_SIZE = config.MAX_FILE_SIZE;

var app = express();
var router = express.Router();


// parse application/json
app.use(bodyParser.json())
app.use(express.static(__dirname + config.CLIENT_APP_DIR));

// parse fields and files
app.use(multer({
  dest: config.TMP_DIR,
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
function WidgetSettings(userEmail, provider, settings, serviceSettings) {
  this.userEmail = userEmail;
  this.provider = provider;
  this.settings = settings;
  this.serviceSettings = serviceSettings;
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
      userAuth.getGoogleEmail(tokens, function (err, widgetEmail) {
        googleDrive.createFolder(tokens.access_token, function (err, folderId) {
          var serviceSettings = {
            folderId: folderId
          };
          var widgetSettings = new WidgetSettings(widgetEmail || '', provider, null, serviceSettings);
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
});


app.use('/api', function (req, res, next) {

  var instance = 'whatever';//req.header('X-Wix-Instance');

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
  req.widgetIds.compId = '12345';
  next();
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

  db.token.remove(req.widgetIds, function (err, removedTokens) {
    if (!removedTokens) {
      return next(error('not logged in', httpStatus.BAD_REQUEST));
    }

    var widgetSettings = new WidgetSettings(null, '', null, {});

    db.widget.updateSettings(req.widgetIds, widgetSettings, function (err) {
      if (err) {
        return next(error('settings update error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      if (removedTokens.provider === 'google') {
        var oauth2Client = userAuth.createOauth2Client();
        oauth2Client.revokeToken(removedTokens.refresh_token, function (err) {
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
          uploadSizeLimit: (capacity > MAX_FILE_SIZE) ? MAX_FILE_SIZE : capacity,
          status: httpStatus.OK
        };
        res.status(httpStatus.OK);
        res.json(resJson);
      });
    });
  });
});



app.post('/api/files/upload/:compId', function (req, res, next) {

  var newFile = req.files.file;
  var sessionId = req.query.sessionId;

  var formatError = null;

  if (!validator.isInt(sessionId)) {
    formatError = error('invalid session format', httpStatus.BAD_REQUEST);
  }

  if (newFile.size >= MAX_FILE_SIZE) {
    formatError = error('file is too large', httpStatus.REQUEST_ENTITY_TOO_LARGE);
  }

  if (formatError) {
    fs.unlink(newFile.path, function () {
      return next(formatError);
    });
  } else {

    db.files.checkSessionAndInsert(newFile, sessionId, function (err, fileId) {
      if (!fileId) {
        fs.unlink(newFile.path, function () {
          return next(error('session expired', httpStatus.BAD_REQUEST));
        });
      }

      var resJson = {
        status: httpStatus.CREATED,
        fileId: fileId
      };
      res.status(httpStatus.CREATED);
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
  var visitorMessage = recievedJson.visitorMessage;

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

  session.isOpen(sessionId, function (err, isOpen) {

    if (err) {
      return callback(err, null);
    }

    if (!isOpen) {
      return callback(new Error('session is closed'), null);
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

          res.status(httpStatus.ACCEPTED);
          res.json({status: httpStatus.ACCEPTED});

          console.log('files to be zipped: ', files);

          var visitor = new Visitor(visitorName, visitorEmail, visitorMessage);
          upload.zipAndInsert(files, visitor, req.widgetIds, sessionId, tokens, function (err, downloadUrl, settings) {
            if (err) {
              console.error('zipping and inserting error: ', err);
              email.sendErrors(settings.user_email, visitor, function (err, res) {
                console.log('sent email errors');
                return;
              });
            } else {
              email.send(settings.user_email, visitor, downloadUrl, function (err) {
                return;
              });
            }
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

  var settingsRecieved = new WidgetSettings(userEmail, null, widgetSettings.settings, null);
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
