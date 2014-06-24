'use strict';

var db = require('./pg-database.js');
var googleapis = require('googleapis');
var googleKeys = require('../config.js').googleKeys;
//var passport = require('passport');
//var GoogleStrategy = require('passport-google-oauth').OAuthStrategy;
var googleDrive = require('./google-drive.js');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var TokenProvider = require('./refresh-token.js');




function setParamsIfNotLoggedIn(params) {
  return function (req, res, next) {
    db.token.get(req.widgetIds, function (err, tokensFromDb) {
      if (!tokensFromDb) {
        params.state = req.widgetIds.instanceId + '+' + req.widgetIds.compId;
        next();
      } else {
        next(error('already logged in to ' + tokensFromDb.provider, httpStatus.BAD_REQUEST));
      }
    });
  }
}


function WixWidget(instance, compId) {

  if (instance === 'whatever') { // for testing purposes
    this.instanceId = instance;
  } else {
    var parsedInstance = wix.parse(instance);
    if (!parsedInstance) {
      throw new Error('invalid instance');
    }
    this.instanceId = parsedInstance.instanceId;
  }
  this.compId = compId;
}

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
    googleAuthCallback(currInstance, params, profile, function (err) {
      if (err) {
        return console.error('googleAuthCallback error: ', err);
        done(err, null);
      }

      done(null, profile);
    });
  }
);


function WidgetSettings(userEmail, provider, settings, serviceSettings) {
  this.userEmail = userEmail;
  this.provider = provider;
  this.settings = settings;
  this.serviceSettings = serviceSettings;
}


function googleAuthCallback(currInstance, tokens, profile, callback) {
  var provider = 'google';
  db.token.insert(currInstance, tokens, provider, function (err) {
    if (err) {
      return callback(err);
    }
    googleDrive.createFolder(tokens.access_token, function (err, folderId) {
      var serviceSettings = {
        folderId: folderId
      };
      db.widget.getSettings(currInstance, function (err, widgetSettingsFromDb) {
        var newWidgetSettings = new WidgetSettings(profile.email || null, provider, null, serviceSettings);

        if (widgetSettingsFromDb) {
          var isEmailSet = widgetSettingsFromDb.user_email !== '';
          // do not update if email already set
          if (isEmailSet) { newWidgetSettings.userEmail = null; }
          db.widget.updateSettings(currInstance, newWidgetSettings, function (err) {
            callback(err);
          });
        } else {
          newWidgetSettings.settings = null;
          db.widget.insertSettings(currInstance, newWidgetSettings, function (err) {
            callback(err);
          });
        }
      });
    });
  });
}


function getInstanceTokens(instance, callback) {

  db.token.get(instance, function (err, tokens) {

    if (!tokens) {
      return callback(err, null);
    }

    if (!db.token.isAccessTokenExpired(tokens)) {
      console.log('Got valid token from database: ', tokens.access_token);
      return callback(null, tokens);
    }

    var tokenProvider;


    if (tokens.provider === 'google') {
      tokenProvider = new TokenProvider.GoogleTokenProvider({
          refresh_token: tokens.refresh_token,
          client_id:     googleKeys.clientId,
          client_secret: googleKeys.clientSecret
      });
      tokenProvider.getToken(function (refreshedTokens) {
        if (err) { console.error('token refreshing error: ', err); }
        console.log('Got new token from google: ', refreshedTokens);

        db.token.update(instance, refreshedTokens, 'google', callback);
      });
    }
  });
}


module.exports = {
  getInstanceTokens: getInstanceTokens,
  googleAuthCallback: googleAuthCallback,
  googleStrategy: googleStrategy,
  setParamsIfNotLoggedIn: setParamsIfNotLoggedIn
};
