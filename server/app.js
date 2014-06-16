'use strict';

var userAuth = require('./controllers/user-auth.js');
var db = require('./controllers/pg-database.js');
var upload = require('./controllers/upload-files.js');
var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var validator = require('validator');
var pg = require('pg');
var wix = require('wix');
var httpStatus = require('http-status');
var connectionString = process.env.DATABASE_URL || require('./connect-keys/pg-connect.json').connectPg;
var app = express();
var router = express.Router();

wix.secret(require('./connect-keys/wix-key.json').secret);
app.use(bodyParser());
app.use(express.static(__dirname));
app.use(multer({
  dest: './tmp/'
}));


// parse instance and sets parsed insatnceId
function WixWidget(instance, compId) {
  var parsedInstance = wix.parse(instance);
  if (!parsedInstance) {
    throw new Error('invalid instance')
  }
  this.instanceId = parsedInstance.instanceId;
  this.compId = compId;
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


app.get('/oauth2callback', function (req, res) {
  userAuth.exchangeCodeForTokens(req.query.code, function (err, tokens) {
    console.log('tokens from google: ', tokens);
    console.log('oauth2callback state: ', req.query.state);

    var wixIds = req.query.state.split('+');
    var currInstance = new WixWidget(wixIds[0], wixIds[1]);

    var provider = 'google';
    pg.connect(connectionString, function (err, client, done) {
      if (err) { console.error('db connection error: ', err); }

      db.token.insert(client, currInstance, tokens, provider, function (err) {
        userAuth.getWidgetEmail(tokens, function (err, widgetEmail) {
          var widgetSettings = new WidgetSettings(widgetEmail || '', provider, null);
          db.widget.getSettings(client, currInstance, function (err, widgetSettingsFromDb) {
            if (widgetSettingsFromDb !== null) {
              var isEmailSet = widgetSettingsFromDb.user_email !== '';
              // do not update if email already set
              if (isEmailSet) { widgetSettings.userEmail = null; }
              db.widget.updateSettings(client, currInstance, widgetSettings, function (err) {
                done();
                pg.end();
                res.redirect('/');
              });
            } else {
              widgetSettings.settings = '{}';
              db.widget.insertSettings(client, currInstance, widgetSettings, function (err) {
                done();
                pg.end();
                res.redirect('/');
              });
            }
          });
        });
      });
    });
  });
});


app.use('/api', function(req, res, next){

  // var currInstance = {
  //   instanceId: 'whatever',
  //   compId: 'however'
  // };
  var componentId = req.params.compId;
  var instance = req.header('X-Wix-Instance');
  if (!componentId || !instance) {
    return next(error('componentId and instanceId required', httpStatus.BAD_REQUEST));
  }

  var currInstance;
  try {
    currInstance = new WixWidget(instance, componentId);
  } catch (e) {
    return next(error(e.message, httpStatus.UNAUTHORIZED));
  }

  req.widgetIds = currInstance;
  next();
});

app.get('/api/auth/login/google/:compId', function (req, res) {

  pg.connect(connectionString, function (err, client, done) {
    db.token.get(client, req.widgetIds, 'google', function (err, tokensFromDb) {
      if (tokensFromDb !== null) {
        userAuth.getGoogleAuthUrl(req.widgetIds, function (url) {
          done();
          pg.end();
          res.redirect(url);
        });
      } else {
        console.error('You are still signed in with Google.');
        done();
        pg.end();
        res.redirect('/api/auth/logout/google/' + widgetIds.compId);
      }
    });
  });
});

app.get('/api/auth/logout/google/:compId', function (req, res, next) {

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    db.token.remove(client, req.widgetIds, 'google', function (err, tokensFromDb) {

      if (err) {
        done();
        pg.end();
        console.error('Your are not signed with Google');
        res.redirect('/');
        return;
      }

      var widgetSettings = new WidgetSettings(null, '', null);

      db.widget.updateSettings(client, req.widgetIds, widgetSettings, function (err, updatedWidgetSettings) {
        var oauth2Client = userAuth.createOauth2Client();
        oauth2Client.revokeToken(tokensFromDb.refresh_token, function (err, result) {
          if (err) {
            console.error('token revoking error', err);
          }

          console.log('revoking token');
          done();
          pg.end();
          res.redirect('/');

        });
      });
    });
  });
});


app.get('/login', function (req, res) {
  res.sendfile('./login.html');
});



app.post('/api/files/upload/:compId', function (req, res, next) {

  var MAX_FILE_SIZE = 1073741824;

  console.log('uploaded file: ', req);
  var newFile = req.files.sendFile;
  var sessionId = req.query.sessionId;

  if (!validator.isNumeric(sessionId)) {
    return next(error('invalid session format', httpStatus.BAD_REQUEST));
  }

  if (newFile.size >= MAX_FILE_SIZE) {
    return next(error('file is too large', httpStatus.REQUEST_ENTITY_TOO_LARGE));
  }

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }
    db.files.updateSessionAndInsert(client, newFile, sessionId, req.widgetIds, function (err, fileId) {
      done();
      pg.end();

      if (err) {
        return next(error('something bad', httpStatus.BAD_REQUEST)); // change status
      }

      var resJson = {
        status: httpStatus.OK,
        fileId: fileId
      };
      res.status(httpStatus.OK);
      res.json(resJson);
    });
  });
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

  var MAX_FILE_SIZE = 1073741824;

  // parse the request

  var recievedJson = req.body;
  var sessionId = req.query.sessionId;

  if (!validator.isNumeric(sessionId)) {
    return next(error('invalid session format', httpStatus.BAD_REQUEST));
  }

  if (!validator.isJSON(recievedJson)) {
    return next(error('request body is not JSON', httpStatus.BAD_REQUEST));
  }

  var visitorEmail = recievedJson.email.trim();
  var visitorName = recievedJson.visitorName.trim();
  var toUploadFileIds = recievedJson.toUpload;
  var visitorMessage = recievedJson.message.trim();

  var isValidFormat = validator.isEmail(visitorEmail) &&
                      toUploadFileIds.isArray() &&
                      !validator.isNull(visitorName) &&
                      !validator.isNull(visitorMessage);


  if (!isValidFormat) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }
    userAuth.getInstanceTokens(client, req.widgetIds, function (err, tokens) {

      if (err) {
        done();
        pg.end();
        console.error('getting instance tokens error', err);
        return next(error('widget is not signed in', httpStatus.BAD_REQUEST));
      }
      db.files.getByIds(client, sessionId, toUploadFileIds, function (err, files) {
        if (err) {
          done();
          pg.end();
          console.error('cannot find files', err);
          return next(error('cannot find files', httpStatus.BAD_REQUEST));
        }

        if (files[0].total_size > MAX_FILE_SIZE) {
          done();
          pg.end();
          console.error('total files size is too large', err);
          // somthing is broken here
          return next(error('total files size is too large', httpStatus.REQUEST_ENTITY_TOO_LARGE));
        } else {
          res.status(httpStatus.ACCEPTED);
          res.json({status: httpStatus.ACCEPTED});

          console.log('files to be zipped: ', files);
          var zipName = visitorName.replace(/\s+/g, '-');

          upload.zip(files, zipName, function (err, archive) {
            upload.insertFile(client, archive, sessionId, req.widgetIds, tokens, function (err, result) {
              if (err) { console.error('uploading to google error', err); }
              console.log('inserted file: ', result);
              done();
              pg.end();
            });
          });
        }
      });
    });
  });
});


// /api/settings/:compId to recieve a sessionId

app.get('/api/settings/:compId', function (req, res, next) {


  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    db.widget.getSettings(client, req.widgetIds, function (err, widgetSettings) {
      var settingsResponse = {
        status: httpStatus.OK,
        userEmail: '',
        provider: '',
        settings: {}
      };

      if (widgetSettings !== null) {
        settingsResponse.userEmail = widgetSettings.user_email;
        settingsResponse.provider = widgetSettings.curr_provider;
        settingsResponse.settings = JSON.parse(widgetSettings.settings);
      }

      db.session.open(client, req.widgetIds, function (err, sessionId) {
        settingsResponse.sessionId = sessionId;
        done();
        pg.end();
        res.status(httpStatus.OK);
        res.json({widgetSettings: settingsResponse});
      });
    });
  });
});


app.put('/api/settings/:compId', function (req, res, next) {

  var widgetSettings = req.body.widgetSettings;
  var userEmail = widgetSettings.userEmail.trim();
  var isValidSettings = widgetSettings &&
                        (userEmail === '' ||
                         validator.isEmail(userEmail)) &&
                        validator.isJSON(widgetSettings.settings);

  if (!isValidSettings) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }

  var settingsRecieved = new WidgetSettings(userEmail, null, widgetSettings);
  pg.connect(connectionString, function (err, client, done) {
    console.log('/api/settings/:compId connected to db');
    if (err) { console.error('db connection error: ', err); }
    db.widget.updateSettings(client, req.widgetIds, settingsRecieved, function (err, updatedWidgetSettings) {

      if (err) {
        db.widget.insertSettings(client, req.widgetIds, settingsRecieved, function (err) {
          done();
          pg.end();
          res.status(httpStatus.CREATED);
          res.json({status: httpStatus.CREATED});
        });
      } else {
        done();
        pg.end();
        res.status(httpStatus.CREATED);
        res.json({status: httpStatus.CREATED});
      }
    });
  });
});

app.use(function (err, req, res, next) {
  var errorStatus = err.status || httpStatus.INTERNAL_SERVER_ERROR;
  res.send(errorStatus, {status: errorStatus, error: err.message });
});

app.use(function (req, res) {
  res.send(httpStatus.NOT_FOUND, {status: httpStatus.NOT_FOUND, error: "Lame, can't find that" });
});



module.exports = app;
