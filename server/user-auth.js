'use strict';

var googleapis = require('googleapis');
var OAuth2 = googleapis.auth.OAuth2;
var clientId = require('./client-id.json').web;


var hostServer = 'open.ge.tt';
var oauth2Client = new OAuth2(clientId.client_id, clientId.client_secret, clientId.redirect_uris[0]);

function getGoogleAuthUrl(callback) {


  var scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'email'
  ];

  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes.join(" ") // space delimited string of scopes
  });

  callback(url);
}

function handleGoogleToken(code, callback) {
  console.log("code: ", code);
  oauth2Client.getToken(code, function(err, tokens) {
    callback(tokens);
  });
}


module.exports = {
  getGoogleAuthUrl: getGoogleAuthUrl,
  handleGoogleToken: handleGoogleToken,
  oauth2Client: oauth2Client
};
