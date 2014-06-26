'use strict';

var googleKeys = require('../config.js').googleKeys;
var utils = require('../utils.js');
var userAuth = require('../controllers/user-auth.js');
var WixWidget = utils.WixWidget;


var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;


var googleStrategy = new GoogleStrategy({
  clientID: googleKeys.clientId,
  clientSecret: googleKeys.clientSecret,
  callbackURL: googleKeys.redirectUri,
  passReqToCallback: true
}, function (req, accessToken, refreshToken, params, profile, done) {
  console.log('oauth2callback state: ', req.query.state);
  console.log('tokens: ', params);
  console.log('refreshToken: ', refreshToken);

  var wixIds = req.query.state.split('+');
  var currInstance = new WixWidget(wixIds[0], wixIds[1]);
  params.refresh_token = refreshToken;
  userAuth.googleAuthCallback(currInstance, params, profile, function (err) {
    if (err) {
      console.error('googleAuthCallback error: ', err);
      return done(err, null);
    }

    done(null, profile);
  });
});

module.exports = function (app) {

  var passport = require('passport');


  app.use(passport.initialize());

  passport.use('google', googleStrategy);

  return passport;

};