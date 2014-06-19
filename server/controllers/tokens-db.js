'use strict';

var query = require('../config.js').query;

function calcTokenExpiresDate(expiresIn) {
  var date = new Date();
  return new Date(date.getTime() + (expiresIn - 60) * 1000);
}

function isAccessTokenExpired(token) {
  var expiresOn = +new Date(token.expires);
  var now = +new Date();
  return expiresOn < now;
}

function insert(instance, tokens, provider, callback) {
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
      console.error('tokens insert error: ', err);
      return callback(err);
    }

    callback(null);
  });
}

function get(instance, callback) {
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
      console.error('get token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}


function update(instance, tokens, provider, callback) {

  var q = 'UPDATE oauth_token \
           SET access_token =  $1, expires = $2 \
           WHERE instance_id = $3 \
           AND component_id = $4 \
           AND provider = $5 \
           RETURNING *';
  var values = [
    tokens.access_token,
    calcTokenExpiresDate(tokens.expires_in),
    instance.instanceId,
    instance.compId,
    provider
  ];

  query(q, values, function (err, rows, result) {
    if (err) {
      console.error('update token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}

function remove(instance, callback) {
  var q = 'DELETE FROM oauth_token \
           WHERE instance_id = $1 \
           AND component_id = $2 \
           RETURNING *';
  var values = [
    instance.instanceId,
    instance.compId,
  ];

  query(q, values, function (err, rows, result) {
    if (err) {
      console.error('delete token error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}


module.exports = {
  insert: insert,
  get: get,
  remove: remove,
  update: update,
  isAccessTokenExpired: isAccessTokenExpired,
};