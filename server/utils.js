'use strict';

var config = require('./config.js');
var wix = config.wix;


// parse instance and sets parsed insatnceId
module.exports.WixWidget = function (instanceId, compId) {
  this.instanceId = instanceId;
  this.compId = compId;
};

module.exports.Visitor = function (name, email, message) {
  this.name = name;
  this.email = email;
  this.message = message;
};

// set any param to null to avoid it's update
module.exports.WidgetSettings = function (userEmail, provider, settings, serviceSettings) {
  this.userEmail = userEmail;
  this.provider = provider;
  this.settings = settings;
  this.serviceSettings = serviceSettings;
};


module.exports.error = function (message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
};

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
