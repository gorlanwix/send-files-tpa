'use strict';

var pg = require('pg');
var db = require('./pg-database.js');
var connectionString = process.env.DATABASE_URL || require('../connect-keys/pg-connect.json').connectPg;
var googleapis = require('googleapis');
var OAuth2 = googleapis.auth.OAuth2;
var clientId = require('../connect-keys/client-id.json').web;


function createOauth2Client(tokens) {
  var oauth2Client = new OAuth2(clientId.client_id, clientId.client_secret, clientId.redirect_uris[0]);
  if (arguments.length === 1) {
    oauth2Client.credentials = tokens;
  }

  return oauth2Client;
}


function getGoogleAuthUrl(instance, callback) {
  var oauth2Client = createOauth2Client();

  var scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'email'
  ];
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    state: instance.instanceId + '+' + instance.compId,
    display: 'popup',
    scope: scopes.join(" ")
  });

  callback(url);
}

function exchangeCodeForTokens(code, callback) {
  var oauth2Client = createOauth2Client();

  console.log("code: ", code);
  oauth2Client.getToken(code, function (err, tokens) {
    if (err) {
      console.error('Retrieving token error: ', err);
      return callback(err, null);
    }

    callback(null, tokens);
  });
}

function getInstanceTokens(client, instance, callback) {

  db.token.get(client, instance, function (err, tokens) {

    if (err) {
      return callback(err, null);
    }

    if (!db.token.isAccessTokenExpired(tokens)) {
      console.log('Got valid token from database: ', tokens.access_token);
      return callback(null, tokens);
    }


    if (tokens.auth_provider === 'google') {
      var oauth2Client = createOauth2Client(tokens);
      oauth2Client.refreshAccessToken(function (err, refreshedTokens) {
        if (err) { console.error('token refreshing error: ', err); }
        console.log('Got new token from google: ', refreshedTokens);

        db.token.update(client, instance, refreshedTokens, 'google', function (err, result) {
          if (err) {
            return callback(err, null);
          }

          callback(null, result);
        });
      });
    }
  });
}



function getWidgetEmail(tokens, callback) {
  var oauth2Client = createOauth2Client(tokens);
  googleapis
    .discover('oauth2', 'v2')
    .execute(function (err, client) {
      if (err) { console.error('connection to google error: ', err); }
      client
        .oauth2
        .userinfo
        .get()
        .withAuthClient(oauth2Client)
        .execute(function (err, result) {

          if (err) {
            console.error('profile info retrieving error: ', err);
            return callback(err, null);
          }
          // Shows user email
          console.log(result);
          callback(null, result.email);
        });
    });
}


module.exports = {
  getGoogleAuthUrl: getGoogleAuthUrl,
  exchangeCodeForTokens: exchangeCodeForTokens,
  getInstanceTokens: getInstanceTokens,
  createOauth2Client: createOauth2Client,
  getWidgetEmail: getWidgetEmail
};
