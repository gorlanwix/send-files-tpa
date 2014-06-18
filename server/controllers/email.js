'use strict';

var emailKey = require('../connect-keys/mailgun-key.json');
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
  this.replyTo = visitorEmail;
  this.subject = visitorName + ' - Wix Send Files';
  this.html = body;
}

function constructMessage(visitorName, visitorEmail, visitorMessage, downloadUrl) {
  var emailBackLink = '<a href="mailto:' + visitorEmail + '">' + visitorEmail + '</a>';
  var body = visitorName + ' ('+ emailBackLink + ') sent you some files.' + '<br /><br />';
  body += visitorMessage + '<br /><br />';
  body += 'Download files: ';
  body += '<a href="' + downloadUrl + '">' + downloadUrl + '</a>';

  return body;
}

function send(userEmail, visitor, callback) {

  var smtpTransport = getTransport();
  var emailMessage = constructMessage(visitor.name, visitor.email, visitor.message, visitor.fileUrl);

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

module.exports = {
  send: send
};


