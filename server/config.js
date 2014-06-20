var query = require('pg-query');
var wix = require('wix');

var MAX_FILE_SIZE = 1024 * 1024 * 1024 * 1;
var MAX_UPLOAD_RECOVERS = 10;


wix.secret(require('./connect-keys/wix-key.json').secretKey);
query.connectionParameters = process.env.DATABASE_URL || require('./connect-keys/pg-connect.json').connectPg;

module.exports = {
  MAX_FILE_SIZE: MAX_FILE_SIZE,
  query: query
};