var query = require('pg-query');
var wix = require('wix');

exports.MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
exports.MAX_UPLOAD_RECOVERS = 10;
exports.EXPIRE_TIME = 1000 * 60 * 60 * 23; // 23 hours in miliseconds

exports.TMP_DIR = './tmp/';
exports.CLIENT_APP_DIR = process.env.CLIENT_DIR || '../../client/app';


var googleScopes = [
  'https://www.googleapis.com/auth/drive.file',
  'email'
];

var googleParams =  {
  accessType: 'offline', // will return a refresh token
  approvalPrompt: 'force', // will ask for allowing every time (in case same account but different widgets)
  state: null,
  display: 'popup',
  scope: googleScopes
};

var dropboxParams =  {
  force_reapprove: true, // will ask for allowing every time (in case same account but different widgets)
  state: null,
};


exports.auth = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || require('./connect-keys/google-id.json').web.client_id,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || require('./connect-keys/google-id.json').web.client_secret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || require('./connect-keys/google-id.json').web.redirect_uris[0],
    params: googleParams
  },
  dropbox: {
    clientId: process.env.DROPBOX_CLIENT_ID || require('./connect-keys/dropbox-id.json').appKey,
    clientSecret: process.env.DROPBOX_CLIENT_SECRET || require('./connect-keys/dropbox-id.json').appSecret,
    redirectUri: process.env.DROPBOX_REDIRECT_URI || require('./connect-keys/dropbox-id.json').redirectUri,
    params: dropboxParams
  }
};



// 'https://www.example.net/auth/dropbox-oauth2/callback'


exports.wixKeys = {
  appKey: process.env.WIX_APP_KEY || require('./connect-keys/wix-key.json').appKey,
  secretKey: process.env.WIX_SECRET_KEY || require('./connect-keys/wix-key.json').secretKey
};


exports.mailgunKeys = {
  username: process.env.MAILGUN_SMTP_LOGIN || require('./connect-keys/mailgun-key.json').username,
  pass: process.env.MAILGUN_SMTP_PASSWORD || require('./connect-keys/mailgun-key.json').pass,
  apiKey: process.env.MAILGUN_API_KEY || require('./connect-keys/mailgun-key.json').apiKey
};


query.connectionParameters = process.env.DATABASE_URL || require('./connect-keys/pg-connect.json').connectPg;
wix.secret(exports.wixKeys.secretKey);

module.exports.query = query;
module.exports.wix = wix;
