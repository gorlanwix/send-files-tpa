'use strict';

var wixKeys = require('../config.js').wixKeys;

var wixapi = require('openapi-node');

function configureWix(instance) {
  return wixapi.getAPI(wixKeys.secretKey, wixKeys.appKey, instance.instanceId);
}

function constructMessage(visitor, viewUrl) {
  var emailBackLink = '<a href="mailto:' + visitorEmail + '">' + visitorEmail + '</a>';
  var body = visitor.name.first + ' ' + visitor.name.last +
             ' (' + emailBackLink + ') sent you some files.' + '<br /><br />';
  body += visitor.message + '<br /><br />';
  body += 'View files: ';
  body += '<a href="' + viewUrl + '">' + viewUrl + '</a>';

  return body;
}

module.exports.post = function (instance, visitor, viewUrl, callback) {

  var wix = configureWix(instance);

  wix.Activities.getTypes()
    .then(function(data) {
      console.log(data);
    }, function(error) {
      console.log(error);
    });

  var activity = wix.Activities.newActivity(wix.Activities.TYPES.CONTACT_FORM);
  var cu = activity.contactUpdate;
  cu.addEmail(cu.newEmail().withTag('main').withEmail(visitor.email));
  cu.name.withFirst(visitor.name.first).withLast(visitor.name.last);

  activity.withLocationUrl(viewUrl).withActivityDetails(constructMessage(visitor, viewUrl), viewUrl);
  var ai = activity.activityInfo;
  ai.addField(ai.newField().withName('email').withValue(visitor.email));
  ai.addField(ai.newField().withName('first').withValue(visitor.name.first));
  ai.addField(ai.newField().withName('last').withValue(visitor.name.last));


  wix.Activities.postActivity(activity, visitor.wixSessionToken)
    .then(function(data) {
      console.log('Success! ', data);
      callback(null, data);
    }, function(error) {
      console.log('activity post error', error);
      callback(new Error('failed to post activity to wix'), null);
    });

  // wix.Insights.getActivitiesSummary()
  //   .then(function(data) {
  //     console.log(data);
  //   }, function(error) {
  //     console.log(error);
  //   });
}
