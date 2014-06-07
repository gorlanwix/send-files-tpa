'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var userAuth = require('./user-auth.js');
var googleDrive = require('./google-drive.js');
var multer  = require('multer');
var googleapis = require('googleapis');
var OAuth2 = googleapis.auth.OAuth2;
var clientId = require('./client-id.json').web;
var oauth2Client = new OAuth2(clientId.client_id, clientId.client_secret, clientId.redirect_uris[0]);


var pg = require('pg');
var database = require('./pg-database.js');
var connectionString = process.env.DATABASE_URL || require('./pg-connect.json').connectPg;


var app = express();

app.use(multer({ dest: './tmp/'}));

app.use(bodyParser());
app.use(express.static(__dirname));

var host = 'http://send-files.heroku.com/';
// var options = {
//     host: 'requestb.in',
//     port: 80,
//     path: '/nfue7rnf',
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//       'Content-Length': Buffer.byteLength(data)
//     }
//   };

app.get('/oauth2callback', function (req, res) {
    userAuth.getGoogleTokens(oauth2Client, req.query.code, function(tokens) {
        console.log('tokens: ', tokens);
        pg.connect(connectionString, function(err, client, done) {
            if(err) console.error('db connection error: ', err);

            //TODO: guard against already created widgets doing this again, update instead
            database.insertWidget(client, 'whatever', 'whatever', function(result) {
                database.insertTokens(client, result.rows[0].widget_id, tokens, function(result) {
                    done();
                    pg.end();
                    res.redirect('/');
                });
            });
        });
    });
});

app.get('/login-google', function(req, res) {
    userAuth.getGoogleAuthUrl(oauth2Client, function(url) {
        res.redirect(url);
    });
});


app.post('/upload', function (req, res) {
    console.log('uploaded files: ', req.files);
    var newFile = req.files.sendFile;
    var oauth2ClientCurr = new OAuth2(clientId.client_id, clientId.client_secret, clientId.redirect_uris[0]);

    userAuth.setInstanceTokens(oauth2ClientCurr, 'whatever', 'whatever', function(result) {
        googleapis
            .discover('drive', 'v1')
            .execute(function(err, client) {
                googleDrive.insertFile(client, oauth2ClientCurr, newFile.originalname, newFile.mimetype, newFile.path, function(result) {
                    console.log('inserted file: ', result);
                    res.redirect('/');
                });
            });
    });
});

module.exports = app;
