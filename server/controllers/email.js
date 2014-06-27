'use strict';

var emailKey = require('../config.js').mailgunKeys;
var nodemailer = require('nodemailer');


function getTransport() {
  var smtpTransport = nodemailer.createTransport("Mailgun", {
    auth: {
      user: emailKey.username,
      pass: emailKey.pass
    }
  });

  return smtpTransport;
}



function Email(userEmail, visitorEmail, visitorName, body) {
  this.from = 'Send Files <' + emailKey.username + '>';
  this.to = userEmail;
  if (visitorEmail) {
    this.replyTo = visitorEmail;
  }
  this.subject = visitorName + ' - Wix Send Files';
  this.html = body;
}

function constructMessage(visitorName, visitorEmail, visitorMessage, viewUrl) {
  var emailBackLink = '<a href="mailto:' + visitorEmail + '">' + visitorEmail + '</a>';
  var body = visitorName + ' (' + emailBackLink + ') sent you some files.' + '<br /><br />';
  body += visitorMessage + '<br /><br />';
  body += 'Download files: ';
  body += '<a href="' + viewUrl + '">' + viewUrl + '</a>';

  return body;
}

function constructErrorMessageUser(visitorName, visitorEmail, visitorMessage) {
  var emailBackLink = '<a href="mailto:' + visitorEmail + '">' + visitorEmail + '</a>';
  var body = visitorName + ' (' + emailBackLink + ') tried to send you some files with message:' + '<br />';
  body += visitorMessage + '<br /><br />';
  body += 'Unfortunately an error occured during upload. Sorry for inconvenience.';

  return body;
}

function constructErrorMessageVisitor(visitorName, visitorEmail, visitorMessage) {
  var body = 'Unfortunately an error occured during upload.<br />';
  body += 'Your files with the following message were not uploaded:<br />';
  body += visitorMessage + '<br /><br />';
  body += 'Please try again. Sorry for inconvenience.';

  return body;
}

function send(userEmail, visitor, viewUrl, callback) {

  var smtpTransport = getTransport();

  var emailMessage = constructMessage(visitor.name, visitor.email, visitor.message, viewUrl);

  var emailToSend = new Email(userEmail, visitor.email, visitor.name, emailMessage);

  smtpTransport.sendMail(emailToSend, function (err, res) {
    if (err) {
      console.error('Email error: ', err);
      return callback(err, null);
    }
    smtpTransport.close();
    callback(null, res);
  });

}

// sends message to both user and visitor with upload error
function sendErrors(userEmail, visitor, callback) {

  var smtpTransport = getTransport();

  var emailErrorUser = constructErrorMessageUser(visitor.name, visitor.email, visitor.message);
  var emailErrorVisitor = constructErrorMessageVisitor(visitor.name, visitor.email, visitor.message);

  var emailToUser = new Email(userEmail, visitor.email, visitor.name, emailErrorUser);
  var emailToVisitor = new Email(visitor.email, null, visitor.name, emailErrorVisitor);

  smtpTransport.sendMail(emailToVisitor, function (err, res) {
    if (err) {
      console.error('emailToVisitor error: ', err);
      return callback(err, null);
    }
    smtpTransport.sendMail(emailToUser, function (err, res) {
      if (err) {
        console.error('emailToUser error: ', err);
        return callback(err, null);
      }

      smtpTransport.close();
      callback(null, res);
    });
  });
}

module.exports = {
  send: send,
  sendErrors: sendErrors
};


