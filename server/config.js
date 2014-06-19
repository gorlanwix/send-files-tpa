var query = require('pg-query');
var connectionString = process.env.DATABASE_URL || require('./connect-keys/pg-connect.json').connectPg;
query.connectionParameters = connectionString;

module.exports = {
  query: query
};