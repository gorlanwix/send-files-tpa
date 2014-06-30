'use strict';

var query = require('../config.js').query;

function calcTokenExpiresDate(expiresIn) {
  var expiresDate = null;
  if (expiresIn) {
    var date = new Date();
    expiresDate = new Date(date.getTime() + (expiresIn - 60) * 1000);
  }
  return expiresDate;
}

module.exports.isAccessTokenExpired = function (token) {
  var expiresOn = +new Date(token.expires);
  var now = +new Date();
  return expiresOn < now;
}

module.exports.insert = function (instance, tokens, provider, callback) {
  var q = 'INSERT INTO oauth_token (instance_id, component_id, access_token, refresh_token, token_type, expires, provider, created) \
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())';
  var values = [
    instance.instanceId,
    instance.compId,
    tokens.access_token,
    tokens.refresh_token,
    tokens.token_type,
    calcTokenExpiresDate(tokens.expires_in),
    provider
  ];

  query(q, values, function (err) {
    if (err) {
      console.error('db tokens insert error: ', err);
      return callback(err);
    }

    callback(null);
  });
}

module.exports.get = function (instance, callback) {
  var q = 'SELECT access_token, refresh_token, expires, provider \
           FROM oauth_token \
           WHERE instance_id = $1 \
           AND component_id = $2 \
           LIMIT 1';
  var values = [
    instance.instanceId,
    instance.compId,
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db get token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}


module.exports.update = function (instance, tokens, callback) {

  var q = 'UPDATE oauth_token \
           SET access_token =  $1, expires = $2 \
           WHERE instance_id = $3 \
           AND component_id = $4 \
           RETURNING *';
  var values = [
    tokens.access_token,
    calcTokenExpiresDate(tokens.expires_in),
    instance.instanceId,
    instance.compId,
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db update token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}

module.exports.remove = function (instance, callback) {
  var q = 'DELETE FROM oauth_token \
           WHERE instance_id = $1 \
           AND component_id = $2 \
           RETURNING *';
  var values = [
    instance.instanceId,
    instance.compId,
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db delete token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}