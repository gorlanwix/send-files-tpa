'use strict';

var db = require('./pg-database.js');
var utils = require('../utils.js');
var authKeys = require('../config.js').auth;
var TokenProvider = require('./refresh-token.js');
var googleDrive = require('../controllers/google-drive.js');


var WidgetSettings = utils.WidgetSettings;



module.exports.authCallback = function (currInstance, tokens, profile, serviceSettings, callback) {
  var provider = profile.provider;
  var userEmail = profile.emails[0].value;
  db.token.insert(currInstance, tokens, provider, function (err) {
    if (err) {
      return callback(err);
    }
    db.widget.getSettings(currInstance, function (err, widgetSettingsFromDb) {

      var newWidgetSettings = new WidgetSettings(userEmail || '', provider, null, serviceSettings);

      if (widgetSettingsFromDb) {
        var isEmailSet = widgetSettingsFromDb.user_email !== '';
        // do not update email if has been set
        if (isEmailSet) {
          newWidgetSettings.userEmail = null;
        }
        db.widget.updateSettings(currInstance, newWidgetSettings, function (err) {
          callback(err);
        });
      } else {
        db.widget.insertSettings(currInstance, newWidgetSettings, function (err) {
          callback(err);
        });
      }
    });
  });
};


var disconnectUser = module.exports.disconnectUser = function (instance, callback) {
  db.token.remove(instance, function (err, removedTokens) {
    if (err) {
      return callback(err, null);
    }
    // set provider and serviceSettings to empty
    var widgetSettings = new WidgetSettings(null, '', null, {});

    db.widget.updateSettings(instance, widgetSettings, function (err) {
      callback(err, removedTokens);
    });
  });
};



module.exports.getInstanceTokens = function (instance, callback) {

  db.token.get(instance, function (err, tokens) {

    if (!tokens) {
      return callback(err, null);
    }

    var tokenProvider;
    switch (tokens.provider) {
    case 'google':
      if (!db.token.isAccessTokenExpired(tokens)) {
        console.log('Got valid token from database: ', tokens.access_token);
        return callback(null, tokens);
      }
      tokenProvider = new TokenProvider.GoogleTokenProvider({
        refresh_token: tokens.refresh_token,
        client_id:     authKeys.google.clientId,
        client_secret: authKeys.google.clientSecret
      });
      tokenProvider.refreshToken(function (err, refreshedTokens, revoked) {
        if (err) {
          console.error('token refreshing error: ', err);
          if (revoked) { // log out user
            disconnectUser(instance, function (err) {
              return callback(err, null);
            });
          } else {
            return callback(err, null);
          }
        } else {
          console.log('Got new token from google: ', refreshedTokens);

          db.token.update(instance, refreshedTokens, 'google', callback);
        }
      });
      break;
    case 'dropbox':
      // dropbox does not provide functionality for refreshing tokens
      callback(null, tokens);
      break;
    default:
      callback(null, null);
      break;
    }
  });
};


module.exports.revokeAccess = function (tokens, callback) {
  switch (tokens.provider) {
  case 'google':
    var oauth2Client = googleDrive.createOauth2Client();
    oauth2Client.revokeToken(tokens.refresh_token, callback);
    break;
  case 'dropbox':
    // request has no api request for this functionality
  default:
    callback(null);
    break;
  }
};
