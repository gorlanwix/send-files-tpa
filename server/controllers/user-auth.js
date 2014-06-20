'use strict';

var db = require('./pg-database.js');
var googleapis = require('googleapis');
var OAuth2 = googleapis.auth.OAuth2;
var googleKeys = require('../config.js').googleKeys;
//var passport = require('passport');
//var GoogleStrategy = require('passport-google-oauth').OAuthStrategy;

function createOauth2Client(tokens) {
  var oauth2Client = new OAuth2(googleKeys.clientId, googleKeys.clientSecret, googleKeys.redirectUri);
  if (arguments.length === 1) {
    oauth2Client.credentials = tokens;
  }

  return oauth2Client;
}

// passport.use(new GoogleStrategy({
//     consumerKey: GOOGLE_CONSUMER_KEY,
//     consumerSecret: GOOGLE_CONSUMER_SECRET,
//     callbackURL: "http://127.0.0.1:3000/auth/google/callback"
//   },
//   function(token, tokenSecret, profile, done) {
//     User.findOrCreate({ googleId: profile.id }, function (err, user) {
//       return done(err, user);
//     });
//   }
// ));


function getGoogleAuthUrl(instance, callback) {
  var oauth2Client = createOauth2Client();

  var scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'email'
  ];

  var params =  {
    access_type: 'offline', // will return a refresh token
    state: instance.instanceId + '+' + instance.compId,
    display: 'popup',
    scope: scopes.join(" ")
  };
  // generate consent page url
  var url = oauth2Client.generateAuthUrl(params);

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

function getInstanceTokens(instance, callback) {

  db.token.get(instance, function (err, tokens) {

    if (!tokens) {
      return callback(err, null);
    }

    if (!db.token.isAccessTokenExpired(tokens)) {
      console.log('Got valid token from database: ', tokens.access_token);
      return callback(null, tokens);
    }


    if (tokens.provider === 'google') {
      var oauth2Client = createOauth2Client(tokens);
      oauth2Client.refreshAccessToken(function (err, refreshedTokens) {
        if (err) { console.error('token refreshing error: ', err); }
        console.log('Got new token from google: ', refreshedTokens);

        db.token.update(instance, refreshedTokens, 'google', callback);
      });
    }
  });
}



function getGoogleEmail(tokens, callback) {
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
  getGoogleEmail: getGoogleEmail
};
