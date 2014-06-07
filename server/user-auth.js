'use strict';

var pg = require('pg');
var database = require('./pg-database.js');
var connectionString = process.env.DATABASE_URL || require('./pg-connect.json').connectPg;
var clientId = require('./client-id.json').web;


var GoogleTokenProvider = require('refresh-token').GoogleTokenProvider;

var hostServer = 'open.ge.tt';

function getGoogleAuthUrl(oauth2Client, callback) {
  var scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'email'
  ];
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: scopes.join(" ")
  });

  callback(url);
}

function getGoogleTokens(oauth2Client, code, callback) {
  console.log("code: ", code);
  oauth2Client.getToken(code, function(err, tokens) {
    if(err)
      console.error('Retrieving token error: ', err);
    callback(tokens);
  });
}

function setInstanceTokens(oauth2Client, instanceId, componentId, callback) {
    pg.connect(connectionString, function(err, client, done) {
        if(err) console.error('db connection error: ', err);
        database.getAccessToken(client, instanceId, componentId, function(result) {
            var expiresOn = +new Date(result.rows[0].expires);
            var now = +new Date();
            if(expiresOn > now) {
                console.log('Got valid token from database: ', result.rows[0].access_token);
                oauth2Client.credentials = {access_token: result.rows[0].access_token};
                done();
                pg.end();
                callback(result);
            } else {
                var googleRefreshToken = new GoogleTokenProvider({
                    refresh_token: result.rows[0].refresh_token,
                    client_id:     clientId.client_id,
                    client_secret: clientId.client_secret
                });
                googleRefreshToken.getToken(function (err, token) {
                    console.log('Got new token from google: ', token);
                    oauth2Client.credentials = {access_token: token};
                    updateAccessToken(client, token, instanceId, componentId, function(result) {
                        done();
                        pg.end();
                        callback(result);
                    })
                });
            }
        });
    });


    // 1. look in database for access tokens
    // 2. if expired call refreshing routine
    // and save in database
    // 3. set credentials to oauth
}


module.exports = {
  getGoogleAuthUrl: getGoogleAuthUrl,
  getGoogleTokens: getGoogleTokens,
  setInstanceTokens: setInstanceTokens
}
