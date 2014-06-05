'use strict';

var express = require('express');
var app = express();

app.get('/', function (req, res) {
  res.header('Content-Type', 'text/plain');
  res.send(200, 'Hello, World!');
});

module.exports = app;
