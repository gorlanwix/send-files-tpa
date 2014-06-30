'use strict';

var config = require('./config.js');
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


module.exports.error = function (message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
};


module.exports.getResponseError = function (statusCode) {
  if (statusCode === 401) {
    return error('invalid access token', httpStatus.UNAUTHORIZED);
  }

  return error('service unavailable', httpStatus.INTERNAL_SERVER_ERROR);
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
