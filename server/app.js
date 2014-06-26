'use strict';

var config = require('./config.js');
var utils = require('./utils.js');

var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var httpStatus = require('http-status');
var passport = require('passport');


var app = express();
var router = express.Router();
var error = utils.error;


// parse application/json
app.use(bodyParser.json());
app.use(express.static(__dirname + config.CLIENT_APP_DIR));
app.use(passport.initialize());

// parse fields and files
app.use(multer({
  dest: config.TMP_DIR,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  }
}));



app.use('/auth', require('./routes/auth.js')(passport, router));
app.use('/api', require('./routes/api.js')(router));



app.use(function (err, req, res, next) {
  var errorStatus = err.status || httpStatus.INTERNAL_SERVER_ERROR;
  res.json(errorStatus, {status: errorStatus, error: err.message });
});

app.use(function (req, res) {
  res.json(httpStatus.NOT_FOUND, {status: httpStatus.NOT_FOUND, error: 'resource not found' });
});



module.exports = app;
