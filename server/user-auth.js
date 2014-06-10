'use strict';

var pg = require('pg');
var database = require('./pg-database.js');
var connectionString = process.env.DATABASE_URL || require('./pg-connect.json').connectPg;
var googleapis = require('googleapis');
var OAuth2 = googleapis.auth.OAuth2;
var clientId = require('./client-id.json').web;


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
    state: instance,
    display: 'popup',
    scope: scopes.join(" ")
  });

  callback(url);
}

function exchangeCodeForTokens(code, callback) {
  var oauth2Client = createOauth2Client();

  console.log("code: ", code);
  oauth2Client.getToken(code, function (err, tokens) {
    if (err) { console.error('Retrieving token error: ', err); }
    callback(tokens);
  });
}

function getInstanceTokens(instance, callback) {

  pg.connect(connectionString, function (err, client, done) {
    if (err) { console.error('db connection error: ', err); }
    database.getToken(client, instance, 'google', function (tokens) {

      if (database.isAccessTokenExpired(tokens)) {
        console.log('Got valid token from database: ', tokens.access_token);
        done();
        pg.end();
        callback(tokens);
      } else {
        var oauth2Client = createOauth2Client();
        oauth2Client.credentials = {refresh_token: tokens.refresh_token};

        oauth2Client.refreshAccessToken(function (err, refreshedTokens) {
          if (err) { console.error('token refreshing error: ', err); }
          console.log('Got new token from google: ', refreshedTokens);

          database.updateToken(client, instance, refreshedTokens, 'google', function (result) {
            done();
            pg.end();
            callback(result);
          });
        });
      }
    });
  });
}



function getWidgetEmail(tokens, callback) {
  var oauth2Client = createOauth2Client(tokens);
  googleapis
    .discover('oauth2', 'v2')
    .execute(function (error, client) {
      client
        .oauth2
        .userinfo
        .get()
        .withAuthClient(oauth2Client)
        .execute(function(err, results){
          if (err) { console.error('profile info retrieving error: ', err); }
          // Shows user email
          console.log(results);
          callback(results.email);
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
