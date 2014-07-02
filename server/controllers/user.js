'use strict';

var db = require('../models/pg-database.js');
var authKeys = require('../config.js').auth;
var TokenProvider = require('./refresh-token.js');
var googleDrive = require('../controllers/google-drive.js');
var utils = require('../utils.js');
var error = utils.error;
var httpStatus = require('http-status');

var WidgetSettings = db.widget.WidgetSettings;

/**
 * Signs in user with a service
 * @param  {WixWidget} instance
 * @param  {Object}    tokens
 * @param  {Object}    profile
 * @param  {Object}    serviceSettings
 * @param  {Function}  callback
 * @return {Error}
 */
module.exports.insert = function (instance, tokens, profile, serviceSettings, callback) {
  var provider = profile.provider;
  db.token.insert(instance, tokens, provider, function (err) {
    if (err) {
      return callback(err);
    }
    var widgetSettings = new WidgetSettings(profile, provider, null, serviceSettings);

    db.widget.updateOrInsertSettings(instance, widgetSettings, callback);
  });
};

/**
 * Removes user's service account information
 * @param  {WixWidget} instance
 * @param  {Function}  callback
 * @return {Error}
 * @return {Object}    tokens
 */
var remove = module.exports.remove = function (instance, callback) {
  db.token.remove(instance, function (err, removedTokens) {
    if (err) {
      return callback(err, null);
    }
    // set profile, provider and serviceSettings to empty
    var widgetSettings = new WidgetSettings({}, '', null, {});

    db.widget.updateSettings(instance, widgetSettings, function (err) {
      callback(err, removedTokens);
    });
  });
};

/**
 * Gets fresh google tokens
 * @param  {WixWidget} instance
 * @param  {Object}    tokens
 * @param  {Function}  callback
 * @return {Error}
 * @return {Object}    tokens with fresh access token
 */
function getGoogleInstanceToken(instance, tokens, callback) {
  if (!db.token.isAccessTokenExpired(tokens)) {
    console.log('Got valid token from database: ', tokens.access_token);
    return callback(null, tokens);
  }

  var tokenProvider = new TokenProvider.GoogleTokenProvider({
    refresh_token: tokens.refresh_token,
    client_id:     authKeys.google.clientId,
    client_secret: authKeys.google.clientSecret
  });

  tokenProvider.refreshToken(function (err, refreshedTokens, revoked) {
    if (err) {
      console.error('token refreshing error: ', err);
      if (revoked) { // log out user
        remove(instance, function (removeError) {
          if (removeError) {
            return callback(removeError, null);
          }
          return callback(err, null);
        });
      } else {
        return callback(err, null);
      }
    } else {
      console.log('Got new token from google: ', refreshedTokens);

      db.token.update(instance, refreshedTokens, callback);
    }
  });
}


/**
 * Gets fresh tokens for currently signed in account
 * @param  {WixWidget} instance
 * @param  {Function}  callback
 * @return {Error}
 * @return {Object}    tokens with fresh access token
 */
module.exports.getTokens = function (instance, callback) {

  db.token.get(instance, function (err, tokens) {

    if (err) {
      return callback(err, null);
    }

    if (!tokens) {
      return callback(error('user is disconnected', httpStatus.UNAUTHORIZED), null);
    }

    switch (tokens.provider) {
    case 'google':
      getGoogleInstanceToken(instance, tokens, callback);
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

/**
 * Revokes access for currently signed in accout
 * @param  {Object}   tokens
 * @param  {Function} callback
 * @return {Error}
 */
module.exports.revokeAccess = function (tokens, callback) {
  switch (tokens.provider) {
  case 'google':
    var oauth2Client = googleDrive.createOauth2Client();
    oauth2Client.revokeToken(tokens.refresh_token, callback);
    break;
  case 'dropbox':
    // dropbox has no api request for this functionality
  default:
    callback(null);
    break;
  }
};
