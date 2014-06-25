var query = require('pg-query');
var wix = require('wix');

exports.MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
exports.MAX_UPLOAD_RECOVERS = 10;
exports.EXPIRE_TIME = 1000 * 60 * 60 * 23; // 23 hours in miliseconds

exports.TMP_DIR = './tmp/';
exports.CLIENT_APP_DIR = '../../client/app';


exports.googleKeys = {
  clientId: process.env.GOOGLE_CLIENT_ID || require('./connect-keys/client-id.json').web.client_id,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || require('./connect-keys/client-id.json').web.redirect_uris[0],
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || require('./connect-keys/client-id.json').web.client_secret
};


exports.wixKeys = {
  appKey : process.env.WIX_APP_KEY || require('./connect-keys/wix-key.json').appKey,
  secretKey : process.env.WIX_SECRET_KEY || require('./connect-keys/wix-key.json').secretKey
};


exports.mailgunKeys = {
  username: process.env.MAILGUN_SMTP_LOGIN || require('./connect-keys/mailgun-key.json').username,
  pass: process.env.MAILGUN_SMTP_PASSWORD || require('./connect-keys/mailgun-key.json').pass,
  apiKey: process.env.MAILGUN_API_KEY || require('./connect-keys/mailgun-key.json').apiKey
};


query.connectionParameters = process.env.DATABASE_URL || require('./connect-keys/pg-connect.json').connectPg;
wix.secret(wixKeys.secretKey);

module.exports = {
  query: query,
  wix: wix,
};