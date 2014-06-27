'use strict';

var config = require('./config.js');
var utils = require('./utils.js');


var auth = require('./middleware/auth.js');
var files = require('./middleware/files.js');
var settings = require('./middleware/settings.js');

var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var httpStatus = require('http-status');



var app = express();
var passport = require('./middleware/passport.js')(app);

var error = utils.error;
var WixWidget = utils.WixWidget;


// parse application/json
app.use(bodyParser.json());
app.use(express.static(__dirname + config.CLIENT_APP_DIR));

// parse fields and files
app.use(multer({
  dest: config.TMP_DIR,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  }
}));


app.use('/auth', function (req, res, next) {

  var instance = req.query.instance;

  if (instance) {
    var instanceId = null;
    try {
      instanceId = utils.getInstanceId(instance);
    } catch (e) {
      return next(error('invalid instance', httpStatus.UNAUTHORIZED));
    }

    req.widgetIds = new WixWidget(instanceId, null);
  }

  next();
});

app.use('/api', function (req, res, next) {

  var instance = req.header('X-Wix-Instance');

  var instanceId = null;
  try {
    instanceId = utils.getInstanceId(instance);
  } catch (e) {
    return next(error('invalid instance', httpStatus.UNAUTHORIZED));
  }

  req.widgetIds = new WixWidget(instanceId, null);
  next();
});

app.param('compId', function (req, res, next, compId) {
  req.widgetIds.compId = compId;

  next();
});


// Authentication

app.get('/auth/logout/:compId', auth.logout);

// Google

var googleParams = config.auth.google.params;

app.get('/auth/login/google/:compId', auth.setParamsIfNotLoggedIn(googleParams), passport.authenticate('google', googleParams));

app.get('/auth/callback/google', passport.authenticate('google', {
  failureRedirect: '/views/verified.html',
  successRedirect: '/views/verified.html',
  session: false
}));

// Dropbox

var dropboxParams = config.auth.dropbox.params;
app.get('/auth/login/dropbox/:compId', auth.setParamsIfNotLoggedIn(dropboxParams), passport.authenticate('dropbox', dropboxParams));

app.get('/auth/callback/dropbox', passport.authenticate('dropbox', {
  failureRedirect: '/views/verified.html',
  successRedirect: '/views/verified.html',
  session: false
}));


// Files

app.get('/api/files/session/:compId', files.session);
app.post('/api/files/upload/:compId', files.upload);
app.post('/api/files/commit/:compId', files.commit);

// Settings

app.get('/api/settings/:compId', settings.get);
app.put('/api/settings/:compId', settings.put);

// error catcher

app.use(function (err, req, res, next) {
  var errorStatus = err.status || httpStatus.INTERNAL_SERVER_ERROR;
  res.json(errorStatus, {status: errorStatus, error: err.message });
});

// 404 not found

app.use(function (req, res) {
  res.json(httpStatus.NOT_FOUND, {status: httpStatus.NOT_FOUND, error: 'resource not found' });
});



module.exports = app;
