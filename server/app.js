'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var userAuth = require('./user-auth.js');
var googleDrive = require('./google-drive.js');
var multer  = require('multer');
var validator = require('validator');
var pg = require('pg');
var db = require('./pg-database.js');
var wix = require('wix');
var connectionString = process.env.DATABASE_URL || require('./pg-connect.json').connectPg;
var app = express();

wix.secret(require('./wix-key.json').secret);
app.use(bodyParser());
app.use(express.static(__dirname));
app.use(multer({
  dest: './tmp/'
}));


// parse instance and sets parsed insatnceId
function WixWidget(instance, compId) {
  this.instanceId = wix.parse(instance).instanceId;
  this.compId = compId;
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

      db.insertToken(client, currInstance, tokens, provider, function (err, result) {
        userAuth.getWidgetEmail(tokens, function (err, widgetEmail) {

          db.getWidgetSettings(client, currInstance, function (err, widgetSettingsFromDb) {
            var widgetSettings = {
              userEmail: widgetEmail,
              provider: provider,
              settings: null  // won't reset anything because there is a COALESCE condition in query
            };
            if (widgetSettingsFromDb === undefined) {
              widgetSettings.settings = '{}';
              db.insertWidgetSettings(client, currInstance, widgetSettings, function (err) {
                done();
                pg.end();
                res.redirect('/');
              });
            } else {
              // do not update if email already set
              var isEmailSet = widgetSettingsFromDb.user_email !== '';
              if (isEmailSet) { widgetSettings.userEmail = null; }
              db.updateWidgetSettings(client, currInstance, widgetSettings, function (err) {
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

app.get('/login/auth/google/:compId', function (req, res) {
  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId);

  pg.connect(connectionString, function (err, client, done) {
    db.getToken(client, currInstance, 'google', function (err, tokensFromDb) {
      if (tokensFromDb === undefined) {
        userAuth.getGoogleAuthUrl(currInstance, function (url) {
          done();
          pg.end();
          res.redirect(url);
        });
      } else {
        console.error('You are still signed in with Google.');
        done();
        pg.end();
        res.redirect('/logout/auth/google');
      }
    });
  });
});

app.get('/logout/auth/google/:compId', function (req, res) {
  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId);

  var widgetSettings = {
    userEmail: null,
    provider: '',
    settings: null  // won't reset anything because there is a COALESCE condition in query
  };
  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    db.deleteToken(client, currInstance, 'google', function (err, tokensFromDb) {
      db.updateWidgetSettings(client, currInstance, widgetSettings, function (err, updatedWidgetSettings) {
        if (tokensFromDb !== undefined) {
          var oauth2Client = userAuth.createOauth2Client();
          oauth2Client.revokeToken(tokensFromDb.refresh_token, function (err, result) {
            if (err) { console.error('token revoking error', err); }

            console.log('revoking token');
            done();
            pg.end();
            res.redirect('/');

          });
        } else {
          done();
          pg.end();
          console.error('Your are not signed with Google');
          res.redirect('/');
        }
      });
    });
  });
});


app.get('/login', function (req, res) {
  res.sendfile('./login.html');
});


function setError(res, message, statusCode) {
  resJson = {
    code: statusCode,
    error: message
  }
  res.status(statusCode);
  return resJson;
}



app.post('/api/files/upload/:compId', function (req, res) {
  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId)

  var MAX_FILE_SIZE = 1073741824;

  console.log('uploaded file: ', req);
  var newFile = req.files.sendFile;
  var sessionId = req.query.sessionId;
  var resJson;

  if (!isNumeric(sessionId)) {
    return res.json(setError(res, 'session is not numeric', 400));
  }

  if (newFile.size >= MAX_FILE_SIZE) {
    return res.json(setError(res, 'file is too large', 413));
  }

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }
    db.session.update(client, sessionId, currInstance, function (err, result) {

      if (err) {
        return res.json(setError(res, 'session is not found', 400));
      }

      db.files.insert(client, sessionId, newFile, function (err, fileId) {
        if (fileId !== undefined) {
          resJson = {
            code: 200,
            fileId: fileId
          }
          res.status(200);
          res.json(resJson);
        }
      });
    });
  });
});


app.post('/api/files/send/:compId', function (req, res) {
  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId)

  userAuth.getInstanceTokens(currInstance, function (err, tokens) {
    if (err) { console.error('getting instance tokens error', err); }

    // TODO: zip files into a single archive
    googleDrive.insertFileAsync(newFile, tokens.access_token, function (err, result) {
      if (err) { console.error('uploading to google error', err); }
      console.log('inserted file: ', result);
    });
  });
});


// /api/settings/:compId?sessionId=true to recieve a sessionId

app.get('/api/settings/:compId', function (req, res) {

  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId);

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    db.getWidgetSettings(client, currInstance, function (err, widgetSettings) {
      var settingsResponse = {
        userEmail: '',
        provider: '',
        settings: {}
      };

      if (widgetSettings !== undefined) {
        settingsResponse.userEmail = widgetSettings.user_email;
        settingsResponse.provider = widgetSettings.curr_provider;
        settingsResponse.settings = JSON.parse(widgetSettings.settings);
      }

      if (req.query.sessionId === 'true') {
        db.session.open(client, currInstance, function(err, sessionId) {
          settingsResponse.sessionId = sessionId;
          done();
          pg.end();
          res.json({widgetSettings: settingsResponse});
          });
      } else {
        done();
        pg.end();
        res.json({widgetSettings: settingsResponse});
      }
    });
  });
});


app.put('/api/settings/:compId', function (req, res) {
  // var instance = req.header('X-Wix-Instance');
  var currInstance = {
    instanceId: 'whatever',
    compId: 'however'
  }; //new WixWidget(instance, req.params.compId);

  var widgetSettings = req.body.widgetSettings;
  var isValidSettings = widgetSettings &&
                        (widgetSettings.userEmail === '' ||
                         validator.isEmail(widgetSettings.userEmail)) &&
                        validator.isJSON(widgetSettings.settings);

  if (isValidSettings) {
    var settingsRecieved = {
      userEmail: widgetSettings.userEmail,
      provider: null, // do not update provider
      settings: JSON.stringfy(widgetSettings.settings)
    };
    pg.connect(connectionString, function (err, client, done) {
      if (err) { console.error('db connection error: ', err); }
      db.updateWidgetSettings(client, currInstance, settingsRecieved, function (err, updatedWidgetSettings) {
        done();
        pg.end();
        req.status(200);
        res.json({code: 200});
      });
    });
  } else {
    res.json({error: 'invalid request format'});
  }
});



module.exports = app;
