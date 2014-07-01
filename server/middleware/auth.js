'use strict';

// /auth/* routes

var user = require('../controllers/user.js');
var db = require('../models/pg-database.js');
var wixKeys = require('../config.js').wixKeys;
var googleDrive = require('../controllers/google-drive.js');
var utils = require('../utils.js');

var WixWidget = utils.WixWidget;
var crypto = require('crypto');
var httpStatus = require('http-status');
var error = utils.error;

/**
 * Encrypts state to be included as param to oauth
 * @param  {String} state oauth param
 * @return {String} encrypted stated
 */
function encryptState(state) {
  var cipher = crypto.createCipher('aes-256-cbc', wixKeys.secretKey);
  var crypted = cipher.update(state, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

/**
 * Decrytps state recieved as a query param in oauth callback
 * @param  {String} state encrypted state
 * @return {[type]}       decrypted state
 */
function decryptState(state) {
  var decipher = crypto.createDecipher('aes-256-cbc', wixKeys.secretKey);
  var dec = decipher.update(state, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

/**
 * Exchanges encrypted instandId and compId for WixWidget
 * @param  {String} state state returned from oauth callback
 * @return {WixWidget}
 */
function stateForWidgetIds(state) {
  var wixIds = decryptState(state).split('+');
  return new WixWidget(wixIds[0], wixIds[1]);
}

/**
 * Removes service json response from profile
 * @param  {Object} profile
 * @return {Object}         profile without fields
 */
function removePrivateProfileFields(profile) {
  delete profile._json;
  delete profile._raw;
  return profile;
}

/**
 * Creates folder in google drive and inserts google user account
 * @params passport callback params
 * @return {Error}
 * @return {Object} profile
 */
module.exports.googleCallback = function (req, accessToken, refreshToken, tokens, profile, done) {
  console.log('google state: ', req.query.state);
  console.log('google tokens: ', tokens);
  console.log('google refreshToken: ', refreshToken);

  var currInstance = stateForWidgetIds(req.query.state);
  tokens.refresh_token = refreshToken;
  googleDrive.createFolder(tokens.access_token, function (err, folderId) {
    if (err) {
      return done(err, null);
    }

    var serviceSettings = {
      folderId: folderId
    };

    profile = removePrivateProfileFields(profile);
    user.insert(currInstance, tokens, profile, serviceSettings, function (err) {
      if (err) {
        console.error('google authCallback error: ', err);
        return done(err, null);
      }

      done(null, profile);
    });
  });

};

/**
 * Inserts dropbox user account
 * @params passport callback params
 * @return {Error}
 * @return {Object} profile
 */
module.exports.dropboxCallback = function (req, accessToken, refreshToken, tokens, profile, done) {
  console.log('dropbox state: ', req.query.state);
  console.log('dropbox accessToken: ', accessToken);
  console.log('dropbox refreshToken: ', refreshToken);
  console.log('dropbox profile: ', profile);
  console.log('dropbox tokens: ', tokens);


  var currInstance = stateForWidgetIds(req.query.state);

  profile = removePrivateProfileFields(profile);
  user.insert(currInstance, tokens, profile, null, function (err) {
    if (err) {
      console.error('dropbox authCallback error: ', err);
      return done(err, null);
    }

    done(null, profile);
  });
};

/**
 * Sets encrypted state param for oauth if user is not logged in
 * @param {Object} params query params for oauth
 */
module.exports.setParamsIfNotLoggedIn = function (params) {
  return function (req, res, next) {
    db.token.get(req.widgetIds, function (err, tokensFromDb) {
      if (!tokensFromDb) {

        var state = req.widgetIds.instanceId + '+' + req.widgetIds.compId;

        params.state = encryptState(state);
        next();
      } else {
        next(error('already connected with ' + tokensFromDb.provider, httpStatus.BAD_REQUEST));
      }
    });
  };
};

/**
 * Logs user out by removing account and revoking access
 * returns status 200 if successfull login
 * returns status 400 if user is not logged in
 * return status 500 if an error occurres
 */
module.exports.logout = function (req, res, next) {

  user.remove(req.widgetIds, function (err, removedTokens) {
    if (!removedTokens) {
      return next(error('account is not connected', httpStatus.BAD_REQUEST));
    }

    if (err) {
      return next(error('account removal error', httpStatus.INTERNAL_SERVER_ERROR));
    }

    user.revokeAccess(removedTokens, function (err) {
      if (err) {
        console.error('token revoking error', err);
        return next(error('token revoking error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      res.status(httpStatus.OK);
      res.json({status: httpStatus.OK});
    });
  });
};
