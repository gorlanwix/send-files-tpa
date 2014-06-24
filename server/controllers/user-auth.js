'use strict';

var db = require('./pg-database.js');
var googleapis = require('googleapis');
var googleKeys = require('../config.js').googleKeys;
var utils = require('../utils.js');
var googleDrive = require('./google-drive.js');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var TokenProvider = require('./refresh-token.js');
var httpStatus = require('http-status');



var WixWidget = utils.WixWidget;
var WidgetSettings = utils.WidgetSettings;
var error = utils.error;



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
  };
}

function googleAuthCallback(currInstance, tokens, profile, callback) {
  var provider = 'google';
  db.token.insert(currInstance, tokens, provider, function (err) {
    if (err) {
      return callback(err);
    }
    googleDrive.createFolder(tokens.access_token, function (err, folderId) {
      if (err) {
        return callback(err);
      }
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
      console.error('googleAuthCallback error: ', err);
      return done(err, null);
    }

    done(null, profile);
  });
});





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
      tokenProvider.refreshToken(function (err, refreshedTokens, revoked) {
        if (err) {
          console.error('token refreshing error: ', err);
          if (revoked) { // log out user
            db.token.remove(instance, function () {
              var widgetSettings = new WidgetSettings(null, '', null, null);
              db.widget.updateSettings(req.widgetIds, widgetSettings, function () {
                return callback(err, null);
              });
            });
          } else {
            return callback(err, null);
          }
        }
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
