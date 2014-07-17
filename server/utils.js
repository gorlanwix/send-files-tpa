'use strict';

var config = require('./config.js');
var httpStatus = require('http-status');
var request = require('request');
var crypto = require('crypto');

var wix = config.wix;


var WixWidget = module.exports.WixWidget = function (instanceId, compId, sessionToken, permissions) {
  this.instanceId = instanceId;
  this.compId = compId;
  this.sessionToken = sessionToken;
  this.permissions = permissions;
};

module.exports.Visitor = function (firstName, lastName, email, message) {
  this.name = {
    first: firstName,
    last: lastName
  };
  this.email = email;
  this.message = message;
};

/**
 * Creates error with status code
 * @param  {String} message    error message
 * @param  {number} statusCode error status code
 * @return {Error}
 */
var error = module.exports.error = function (message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
};



/**
 * Encrypts string with wix key
 * @param  {String} state
 * @return {String} encrypted string
 */
module.exports.encrypt = function (state) {
  var cipher = crypto.createCipher('aes-256-cbc', wix.secret());
  var crypted = cipher.update(state, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

/**
 * Decrypts string with wix key
 * @param  {String} state encrypted string
 * @return {String}       decrypted string
 */
module.exports.decrypt = function (state) {
  var dec = null;
  try {
    var decipher = crypto.createDecipher('aes-256-cbc', wix.secret());
    var dec = decipher.update(state, 'hex', 'utf8');
    dec += decipher.final('utf8');
  } catch (e) {
    dec = null;
    console.error('Invalid encryption');
  }
  return dec;
}

/**
 * Make a request to a service.
 * Returns error depending on response status code.
 * @param  {Object}   options  params to be passed to request
 * @param  {Function} callback
 * @return {Error}             on 400, 401, 403, 404
 */
module.exports.requestService = function (options, callback) {
  request(options, function (err, res) {
    if (err) {
      console.error('request error', err);
      return callback(err, null);
    }

    switch (res.statusCode) {
    case 401:
      return callback(error('invalid access token', res.statusCode), null);
    case 404:
      return callback(error('not found', res.statusCode), null);
    case 400:
      return callback(error('bad request', res.statusCode), null);
    case 403:
      return callback(error('forbidden', res.statusCode), null);
    default:
      return callback(null, res);
    }
  });
};

/**
 * Parses and verifies instance to return instanceId
 * @param  {String} instance widget instance
 * @return {WixWidget}    object identifying widget, without compId
 */
module.exports.parseForWixWidget = function (instance) {
  var instanceId, permissions;
  if (instance === 'whatever') { // for testing purposes
    instanceId = instance;
  } else {
    var parsedInstance = wix.parse(instance);
    console.log('parsedInstance: ', parsedInstance);
    if (!parsedInstance) {
      throw new Error('invalid instance');
    }
    instanceId = parsedInstance.instanceId;
    permissions = parsedInstance.permissions;
  }

  return new WixWidget(instanceId, null, null, permissions);
};
