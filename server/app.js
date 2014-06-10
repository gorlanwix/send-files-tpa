'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var userAuth = require('./user-auth.js');
var googleDrive = require('./google-drive.js');
var multer  = require('multer');


var pg = require('pg');
var database = require('./pg-database.js');
var connectionString = process.env.DATABASE_URL || require('./pg-connect.json').connectPg;

var app = express();

app.use(multer({ dest: './tmp/'}));
app.use(bodyParser());
app.use(express.static(__dirname));

app.get('/oauth2callback', function (req, res) {
  userAuth.exchangeCodeForTokens(req.query.code, function (tokens) {
    console.log('tokens from google: ', tokens);
    console.log('oauth2callback state: ', req.query.state);
    var instance = req.query.state;
    var ids = instance.split('+');
    var currInstance = {
      instanceId: ids[0],
      compId: ids[1]
    };
    var provider = 'google';
    pg.connect(connectionString, function (err, client, done) {
      if (err) { console.error('db connection error: ', err); }

      database.insertToken(client, currInstance, tokens, provider, function (result) {
        userAuth.getWidgetEmail(tokens, function (widgetEmail) {
          var widgetSettings = {
            userEmail: widgetEmail,
            provider: provider,
            settings: null  // won't reset anything because there is a COALESCE condition in query
          };
          database.updateWidgetSettings(client, currInstance, widgetSettings, function (widgetSettingsFromDb) {
            if (widgetSettingsFromDb === undefined) {
              database.insertWidgetSettings(client, currInstance, widgetSettings, function (widgetSettings) {
                done();
                pg.end();
                res.redirect('/');
              });
            } else {
              done();
              pg.end();
              res.redirect('/');
            }
          });
        });
      });
    });
  });
});

app.get('/login/auth/google', function (req, res) {
  var instance = 'whatever+however';
  var ids = instance.split('+');
  var currInstance = {
    instanceId: ids[0],
    compId: ids[1]
  };
  pg.connect(connectionString, function (err, client, done) {
    database.getToken(client, currInstance, 'google', function (tokensFromDb) {
      if (tokensFromDb === undefined) {
        userAuth.getGoogleAuthUrl(instance, function (url) {
          res.redirect(url);
        });
      } else {
        console.error('You are still signed in with Google.');
        res.redirect('/logout/auth/google');
      }
    });
  });
});

app.get('/logout/auth/google', function (req, res) {
  var instance = 'whatever+however';
  var ids = instance.split('+');
  var currInstance = {
    instanceId: ids[0],
    compId: ids[1]
  };
  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    database.deleteToken(client, currInstance, 'google', function (tokensFromDb) {
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


app.get('/login', function (req, res) {
  res.sendfile('./login.html');
});


app.post('/upload', function (req, res) {
  var instance = 'whatever+however';
  var ids = instance.split('+');
  var currInstance = {
    instanceId: ids[0],
    compId: ids[1]
  };

  console.log('uploaded files: ', req.files);
  var newFile = req.files.sendFile;

  userAuth.getInstanceTokens(currInstance, function (tokens) {
    var oauth2Client = userAuth.createOauth2Client(tokens);
    googleDrive.connect(function (err, client) {
      if (err) { console.error('connecting to google error: ', err); }
      googleDrive.insertFile(client, oauth2Client, newFile, function (result) {
        console.log('inserted file: ', result);
        res.redirect('/');
      });
    });
  });
});


app.get('/widget-settings', function (req, res) {
  var instance = 'whatever+however';
  var ids = instance.split('+');
  var currInstance = {
    instanceId: ids[0],
    compId: ids[1]
  };

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }

    database.getWidgetSettings(client, currInstance, function (widgetSettings) {
      var settingsResponse = {
        userEmail: null,
        provider: null,
        settings: null
      };

      if (widgetSettings !== undefined) {
        settingsResponse.userEmail = widgetSettings.user_email;
        settingsResponse.provider = widgetSettings.curr_provider;
        settingsResponse.settings = widgetSettings.settings;
      }
      res.json(settingsResponse);
    });
  });
});

module.exports = app;
