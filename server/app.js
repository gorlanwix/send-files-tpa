'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var userAuth = require('./user-auth.js');
var googleDrive = require('./google-drive.js');
var multer  = require('multer');
var app = express();

app.use(multer({ dest: './tmp/'}));

app.use(bodyParser());
app.use(express.static(__dirname + '/../client/dist'));

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

// app.get('/', function (req, res) {
//   res.send(200, 'ok');
// });

app.get('/oauth2callback', function (req, res) {
    //console.log("req: ", req);
    userAuth.handleGoogleToken(req.query.code, function(tokens) {
        console.log("tokens: ", tokens);
        res.redirect('/');
    });
});

app.get('/login-google', function(req, res) {
    userAuth.getGoogleAuthUrl(function(url) {
        res.redirect(url);
    });
});


app.post('/upload', function (req, res) {
    console.log("req: ", req.files);
    var newFile = req.files.sendFile;
    googleDrive.insertFile(newFile.originalname, newFile.mimetype, function(result) {
        console.log('inserted file: ', result);
        res.redirect('/');
    });
});

module.exports = app;
