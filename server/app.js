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

var error = utils.error;
var WixWidget = utils.WixWidget;



var app = module.exports = express();
var passport = require('./middleware/passport.js')(app);
// parse application/json
app.use(bodyParser.json());
app.use('/views', express.static(__dirname + config.CLIENT_APP_DIR + '/views'));
app.use('/scripts', express.static(__dirname + config.CLIENT_APP_DIR + '/scripts'));
app.use('/styles', express.static(__dirname + config.CLIENT_APP_DIR + '/styles'));
app.use('/images', express.static(__dirname + config.CLIENT_APP_DIR + '/images'));
app.use('/bower_components', express.static(__dirname + config.CLIENT_APP_DIR + '/bower_components'));





// parse fields and files
app.use(multer({
  dest: config.TMP_DIR,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  }
}));


/**
 * CORS?
 */

// app.use(function(req, res, next){
//   if (!req.get('Origin')) return next();
//   res.set('Access-Control-Allow-Origin', 'http://localhost:3000'); //change to whatever is going to be our url
//   res.set('Access-Control-Allow-Methods', 'GET, POST, PUT');
//   res.set('Access-Control-Allow-Headers', 'X-Wix-Instance, Content-Type');
//   if ('OPTIONS' == req.method) return res.send(200);
//   next();
// });


app.use('/auth', function (req, res, next) {

  var instance = req.query.instance;

  if (instance) {
    var widget = null;
    try {
      widget = utils.parseForWixWidget(instance);
    } catch (e) {
      return next(error('invalid instance', httpStatus.UNAUTHORIZED));
    }

    req.widgetIds = widget;
  } else if (!req.query.state) {
    next(error('No instance specified', httpStatus.BAD_REQUEST));
  }
  next();

});


// settings endpoint
app.use('/settings', function (req, res, next) {

  var instance = req.query.instance;
  var compId = req.query.origCompId;
  if (instance) {
    var widget = null;
    try {
      widget = utils.parseForWixWidget(instance);
    } catch (e) {
      return next(error('invalid instance', httpStatus.UNAUTHORIZED));
    }

    req.widgetIds = widget;
    req.widgetIds.compId = compId;
  } else {
    next(error('No instance specified', httpStatus.BAD_REQUEST))
  }
  next();
});

app.use('/api', function (req, res, next) {

  var instance = req.header('X-Wix-Instance');

  var widget = null;
  try {
    widget = utils.parseForWixWidget(instance);
  } catch (e) {
    return next(error('invalid instance', httpStatus.UNAUTHORIZED));
  }
  req.widgetIds = widget;
  next();
});

app.param('compId', function (req, res, next, compId) {
  req.widgetIds.compId = compId;

  next();
});


// Authentication

app.get('/auth/logout/:compId', settings.checkPermissions, auth.logout);

// Google

var googleParams = config.auth.google.params;

app.get('/auth/login/google/:compId',
  settings.checkPermissions,
  auth.setParamsIfNotLoggedIn(googleParams),
  passport.authenticate('google', googleParams));

app.get('/auth/callback/google', passport.authenticate('google', {
  failureRedirect: '/views/verified.html',
  successRedirect: '/views/verified.html',
  session: false
}));

// Dropbox

var dropboxParams = config.auth.dropbox.params;

app.get('/auth/login/dropbox/:compId',
  settings.checkPermissions,
  auth.setParamsIfNotLoggedIn(dropboxParams),
  passport.authenticate('dropbox', dropboxParams));

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
app.get('/settings', settings.checkPermissions, function (req, res) {
  res.sendfile('settings.html', {root: config.CLIENT_APP_DIR.slice(1, config.CLIENT_APP_DIR.length)});
});


// Settings
app.get('/', function (req, res) {
  res.sendfile('index.html', {root: config.CLIENT_APP_DIR.slice(1, config.CLIENT_APP_DIR.length)});
});

app.get('/api/settings/:compId', settings.get);
app.put('/api/settings/:compId', settings.checkPermissions, settings.put);

// error catcher
app.use(function (err, req, res, next) {
  var errorStatus = err.status || httpStatus.INTERNAL_SERVER_ERROR;
  res.json(errorStatus, {status: errorStatus, error: err.message });
});

// 404 not found
app.use(function (req, res) {
  res.json(httpStatus.NOT_FOUND, {status: httpStatus.NOT_FOUND, error: 'resource not found' });
});