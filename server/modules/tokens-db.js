'use strict';

function calcTokenExpiresDate(expiresIn) {
  var date = new Date();
  return new Date(date.getTime() + (expiresIn - 60) * 1000);
}

function isAccessTokenExpired(token) {
  var expiresOn = +new Date(token.expires);
  var now = +new Date();
  return expiresOn > now;
}

function insert(client, instance, tokens, provider, callback) {
  var query = 'INSERT INTO oauth_token (instance_id, component_id, access_token, refresh_token, token_type, expires, auth_provider, created) \
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

  client.query(query, values, function (err) {
    if (err) {
      console.error('tokens insert error: ', err);
      return callback(err);
    }

    callback(null);
  });
}

function get(client, instance, provider, callback) {
  var query = 'SELECT access_token, refresh_token, expires, auth_provider \
               FROM oauth_token \
               WHERE instance_id = $1 \
               AND component_id = $2 \
               AND auth_provider = $3 \
               LIMIT 1';
  var values = [
    instance.instanceId,
    instance.compId,
    provider
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('get token error: ', err);
      return callback(err, null);
    }

    if (result.rows.length === 0) {
      return callback(new Error('Tokens not found'), null);
    }

    callback(null, result.rows[0]);
  });
}


function update(client, instance, tokens, provider, callback) {

  var query = 'UPDATE oauth_token \
               SET access_token =  $1, expires = $2 \
               WHERE instance_id = $3 \
               AND component_id = $4 \
               AND auth_provider = $5 \
               RETURNING *';
  var values = [
    tokens.access_token,
    calcTokenExpiresDate(tokens.expires_in),
    instance.instanceId,
    instance.compId,
    provider
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('update token error: ', err);
      return callback(err, null);
    }

    callback(null, result.rows[0]);
  });
}

function remove(client, instance, provider, callback) {
  var query = 'DELETE FROM oauth_token \
               WHERE instance_id = $1 \
               AND component_id = $2 \
               AND auth_provider = $3 \
               RETURNING *';
  var values = [
    instance.instanceId,
    instance.compId,
    provider
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('delete token error: ', err);
      return callback(err, null);
    }

    callback(null, result.rows[0]);
  });
}


module.exports = {
  insert: insert,
  get: get,
  remove: remove,
  isAccessTokenExpired: isAccessTokenExpired,
};