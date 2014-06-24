'use strict';

var userAuth = require('./controllers/user-auth.js');
var db = require('./controllers/pg-database.js');
var upload = require('./controllers/upload-files.js');
var email = require('./controllers/email.js');
var googleDrive = require('./controllers/google-drive.js');
var config = require('./config.js');
var utils = require('./utils.js');

var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var validator = require('validator');
var fs = require('fs');
var httpStatus = require('http-status');
var passport = require('passport');


var MAX_FILE_SIZE = config.MAX_FILE_SIZE;

var app = express();
var router = express.Router();

var error = utils.error;
var Visitor = utils.Visitor;
var WidgetSettings = utils.WidgetSettings;
var WixWidget = utils.WixWidget;


// parse application/json
app.use(bodyParser.json());
app.use(express.static(__dirname + config.CLIENT_APP_DIR));
app.use(passport.initialize());

// parse fields and files
app.use(multer({
  dest: config.TMP_DIR,
  limits: {
    fileSize: MAX_FILE_SIZE,
  }
}));


passport.use('google', userAuth.googleStrategy);


app.get('/auth/callback/google', passport.authenticate('google', {
  failureRedirect: '/error',
  successRedirect: '/',
  session: false
}));


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
  req.widgetIds.compId = compId;
  next();
});


var scopes = [
  'https://www.googleapis.com/auth/drive.file',
  'email'
];

var params =  {
  accessType: 'offline', // will return a refresh token
  state: null,
  display: 'popup',
  scope: scopes
};

app.get('/api/auth/login/google/:compId', userAuth.setParamsIfNotLoggedIn(params), passport.authenticate('google', params));

app.get('/api/auth/logout/:compId', function (req, res, next) {

  db.token.remove(req.widgetIds, function (err, removedTokens) {
    if (!removedTokens) {
      return next(error('not logged in', httpStatus.BAD_REQUEST));
    }

    var widgetSettings = new WidgetSettings(null, '', null, null);

    db.widget.updateSettings(req.widgetIds, widgetSettings, function (err) {
      if (err) {
        return next(error('settings update error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      if (removedTokens.provider === 'google') {
        var oauth2Client = googleDrive.createOauth2Client();
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
    fs.unlink(newFile.path, function (err) {
      if (err) {
        console.error('removing temp file error: ', err);
      }
      return next(formatError);
    });
  } else {

    db.files.checkSessionAndInsert(newFile, sessionId, function (err, fileId) {
      if (!fileId) {
        fs.unlink(newFile.path, function (err) {
          console.error('removing temp file error: ', err);
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

  userAuth.getInstanceTokens(req.widgetIds, function (err, tokens) {

    if (!tokens) {
      console.error('getting instance tokens error', err);
      return next(error('widget is not signed in', httpStatus.UNAUTHORIZED));
    }

    db.files.getByIds(sessionId, toUploadFileIds, function (err, files) {
      if (!files) {
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
          return next(error('Google Drive is full', httpStatus.REQUEST_ENTITY_TOO_LARGE));
        }
        db.session.close(sessionId, function (err, session) {
          if (!session) {
            return next(error('session has expired', httpStatus.BAD_REQUEST));
          }
          res.status(httpStatus.ACCEPTED);
          res.json({status: httpStatus.ACCEPTED});

          var visitor = new Visitor(visitorName, visitorEmail, visitorMessage);
          upload.zipAndInsert(files, visitor, req.widgetIds, sessionId, tokens, function (err, downloadUrl, settings) {
            if (err) {
              console.error('zipping and inserting error: ', err);
              // email.sendErrors(settings.user_email, visitor, function (err, res) {
              //   if (err) {
              //     console.error('sending error emails error', err);
              //     return;
              //   }
              //   console.log('sent email errors');
              //   return;
              // });
            } else {
              console.log('normal emails sent');
              // email.send(settings.user_email, visitor, downloadUrl, function (err) {
              //   if (err) {
              //     console.error('sending emails error', err);
              //   }
              //   return;
              // });
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
