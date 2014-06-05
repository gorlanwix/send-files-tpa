'use strict';

var express = require('express');
var userAuth = require('./user-auth.js');
var app = express();

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

app.get('/', function (req, res) {
  userAuth('tmedyf5is3rhbmx6r65nw37urjq4u0udi', 'golrlan@wix.com', 'qwerty123', function (data) {
    res.header('Content-Type', 'application/json');
    res.send(200, data);
  });
});


app.post('/upload', function (req, res) {
    req.files.newFile;
})

module.exports = app;
