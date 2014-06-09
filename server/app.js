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
  userAuth.exchangeCodeForTokens(req.query.code, function (tokensFromGoogle) {
    console.log('tokens from google: ', tokensFromGoogle);
    console.log('oauth2callback state: ', req.query.state);
    var instance = req.query.state;
    var ids = instance.split('+');
    pg.connect(connectionString, function (err, client, done) {
      if (err) { console.error('db connection error: ', err); }
      database.getWidgetId(client, ids[0], ids[1], function (widgetId) {
        if (widgetId === undefined) {
          database.insertWidget(client, ids[0], ids[1], function (newWidgetId) {
            database.insertToken(client, newWidgetId, tokensFromGoogle, function (result) {
              done();
              pg.end();
              res.redirect('/');
            });
          });
        } else {
          database.insertToken(client, widgetId, tokensFromGoogle, function (result) {
            done();
            pg.end();
            res.redirect('/');
          });
        }
      });
    });
  });
});

app.get('/login-google', function (req, res) {
  var instance = 'whatever+however';
  var ids = instance.split('+');

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }
    database.deleteToken(client, ids[0], ids[1], function (tokensFromDb) {
      if (tokensFromDb !== undefined) {
        var oauth2Client = userAuth.createOauth2Client();
        oauth2Client.revokeToken(tokensFromDb.refresh_token, function (err, result) {
          if (err) { console.error('token revoking error', err); }
          console.log('revoking token');
          done();
          pg.end();
          // needed because google updates revoking slowely
          setTimeout(function() {
            userAuth.getGoogleAuthUrl(instance, function (url) {
              res.redirect(url);
            });
          }, 3000);
        });
      } else {
        done();
        pg.end();

        userAuth.getGoogleAuthUrl(instance, function (url) {
          res.redirect(url);
        });
      }
    });
  });
});


app.get('/login', function (req, res) {
  res.sendfile('./login.html');
});


app.post('/upload', function (req, res) {
  console.log('uploaded files: ', req.files);
  var newFile = req.files.sendFile;

  userAuth.getInstanceTokens('whatever', 'whatever', function (tokens) {
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

module.exports = app;
