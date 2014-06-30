'use strict';

var authKeys = require('../config.js').auth;
var utils = require('../utils.js');
var user = require('../controllers/user.js');
var googleDrive = require('../controllers/google-drive.js');

var WixWidget = utils.WixWidget;


var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var DropboxStrategy = require('passport-dropbox-oauth2').Strategy;


function parseStateForWidgetIds(state) {
  var wixIds = state.split('+');
  return new WixWidget(wixIds[0], wixIds[1]);
}

var googleStrategy = new GoogleStrategy({
  clientID: authKeys.google.clientId,
  clientSecret: authKeys.google.clientSecret,
  callbackURL: authKeys.google.redirectUri,
  passReqToCallback: true
}, function (req, accessToken, refreshToken, tokens, profile, done) {
  console.log('google state: ', req.query.state);
  console.log('google tokens: ', tokens);
  console.log('google refreshToken: ', refreshToken);

  var currInstance = parseStateForWidgetIds(req.query.state);
  tokens.refresh_token = refreshToken;
  googleDrive.createFolder(tokens.access_token, function (err, folderId) {
    if (err) {
      return callback(err, null);
    }

    var serviceSettings = {
      folderId: folderId
    };
    user.insert(currInstance, tokens, profile, serviceSettings, function (err) {
      if (err) {
        console.error('google authCallback error: ', err);
        return done(err, null);
      }

      done(null, profile);
    });
  });

});




var dropboxStrategy = new DropboxStrategy({
  clientID: authKeys.dropbox.clientId,
  clientSecret: authKeys.dropbox.clientSecret,
  callbackURL: authKeys.dropbox.redirectUri,
  passReqToCallback: true
}, function (req, accessToken, refreshToken, tokens, profile, done) {
  console.log('dropbox state: ', req.query.state);
  console.log('dropbox accessToken: ', accessToken);
  console.log('dropbox refreshToken: ', refreshToken);
  console.log('dropbox profile: ', profile);
  console.log('dropbox tokens: ', tokens);


  var currInstance = parseStateForWidgetIds(req.query.state);

  user.authCallback(currInstance, tokens, profile, null, function (err) {
    if (err) {
      console.error('dropbox authCallback error: ', err);
      return done(err, null);
    }

    done(null, profile);
  });
});

module.exports = function (app) {

  var passport = require('passport');


  app.use(passport.initialize());

  passport.use('google', googleStrategy);
  passport.use('dropbox', dropboxStrategy);

  return passport;
};