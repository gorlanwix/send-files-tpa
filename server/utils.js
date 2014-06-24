'use strict';

var config = require('./config.js');
var wix = config.wix;


// parse instance and sets parsed insatnceId
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

function Visitor(name, email, message) {
  this.name = name;
  this.email = email;
  this.message = message;
}

// set any param to null to avoid it's update
function WidgetSettings(userEmail, provider, settings, serviceSettings) {
  this.userEmail = userEmail;
  this.provider = provider;
  this.settings = settings;
  this.serviceSettings = serviceSettings;
}


function error(message, statusCode) {
  var err = new Error(message);
  err.status = statusCode;
  return err;
}



module.exports = {
  Visitor: Visitor,
  WidgetSettings: WidgetSettings,
  WixWidget: WixWidget,
  error: error
};
