'use strict';

var wixKeys = require('../config.js').wixKeys;

var wixapi = require('openapi-node');

/**
 * Set wix keys
 * @param  {WixWidget} instance
 * @return {Object}    wix object
 */
function configureWix(instance) {
  return wixapi.getAPI(wixKeys.secretKey, wixKeys.appKey, instance.instanceId);
}

/**
 * Create body of activity
 * @param  {Visitor} visitor
 * @param  {String} viewUrl url where uploaded file can be viewed at
 * @return {String} text of the message
 */
function constructMessage(visitor, viewUrl) {
  var emailBackLink = '<a href="mailto:' + visitor.email + '">' + visitor.email + '</a>';
  var body = visitor.name.first + ' ' + visitor.name.last +
             ' (' + emailBackLink + ') sent you some files.' + '<br /><br />';
  body += visitor.message + '<br /><br />';
  body += 'View files: ';
  body += '<a href="' + viewUrl + '">' + viewUrl + '</a>';

  return body;
}


/**
 * Post activity to wix dashboard and creates/updates wix contact
 * @param  {WixWidget} instance
 * @param  {Visitor}   visitor
 * @param  {String}    viewUrl  url where uploaded file can be viewed at
 * @param  {Function}  callback
 * @return {Object}    result of posting an activity
 */
module.exports.post = function (instance, visitor, viewUrl, callback) {

  var wix = configureWix(instance);

  var activity = wix.Activities.newActivity(wix.Activities.TYPES.CONTACT_FORM);
  var cu = activity.contactUpdate;
  cu.addEmail(cu.newEmail().withTag('main').withEmail(visitor.email));
  cu.name.withFirst(visitor.name.first).withLast(visitor.name.last);

  activity.withLocationUrl(viewUrl).withActivityDetails(constructMessage(visitor, viewUrl), viewUrl);
  var ai = activity.activityInfo;
  ai.addField(ai.newField().withName('email').withValue(visitor.email));
  ai.addField(ai.newField().withName('first').withValue(visitor.name.first));
  ai.addField(ai.newField().withName('last').withValue(visitor.name.last));


  wix.Activities.postActivity(activity, instance.sessionToken)
    .then(function(data) {
      console.log('Success! ', data);
      callback(null, data);
    }, function(error) {
      console.log('activity post error', error);
      callback(new Error('failed to post activity to wix'), null);
    });
}
