'use strict';

var config = require('./config.js');
var httpStatus = require('http-status');
var request = require('request');

var wix = config.wix;


// parse instance and sets parsed insatnceId
module.exports.WixWidget = function (instanceId, compId, sessionToken) {
  this.instanceId = instanceId;
  this.compId = compId;
  this.sessionToken = sessionToken;
};

module.exports.Visitor = function (firstName, lastName, email, message) {
  this.name = {
    first: firstName,
    last: lastName
  };
  this.email = email;
  this.message = message;
};


var error = module.exports.error = function (message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
};

module.exports.requestService = function (options, callback) {
  request(options, function (err, res) {
    if (err) {
      console.error('request error', err);
      return callback(err, null);
    }

    switch(res.statusCode) {
    case 401:
      return callback(error('invalid access token', res.statusCode), null);
    case 404:
      return callback(error('not found', res.statusCode), null);
    case 400:
      return callback(error('bad request', res.statusCode), null);
    default:
      return callback(null, res);
    }
  });
}

module.exports.getInstanceId = function (instance) {
  var instanceId;
  if (instance === 'whatever') { // for testing purposes
    instanceId = instance;
  } else {
    var parsedInstance = wix.parse(instance);
    console.log('parsedInstance: ', parsedInstance);
    if (!parsedInstance) {
      throw new Error('invalid instance');
    }
    instanceId = parsedInstance.instanceId;
  }

  return instanceId;
};
