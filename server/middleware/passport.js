'use strict';

var authKeys = require('../config.js').auth;
var utils = require('../utils.js');
var user = require('../controllers/user.js');
var googleDrive = require('../controllers/google-drive.js');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var DropboxStrategy = require('passport-dropbox-oauth2').Strategy;
var auth = require('./auth.js');


var googleStrategy = new GoogleStrategy({
  clientID: authKeys.google.clientId,
  clientSecret: authKeys.google.clientSecret,
  callbackURL: authKeys.google.redirectUri,
  passReqToCallback: true
}, auth.googleCallback);


var dropboxStrategy = new DropboxStrategy({
  clientID: authKeys.dropbox.clientId,
  clientSecret: authKeys.dropbox.clientSecret,
  callbackURL: authKeys.dropbox.redirectUri,
  passReqToCallback: true
}, auth.dropboxCallback);

module.exports = function (app) {

  var passport = require('passport');


  app.use(passport.initialize());

  passport.use('google', googleStrategy);
  passport.use('dropbox', dropboxStrategy);

  return passport;
};