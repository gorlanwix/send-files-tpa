'use strict';

var session = require('./sessions.js');
var files = require('./files-db.js');

// var handleError = function (client, done, err) {
//     // no error occurred, continue with the request
//     if (!err) { return false; }

//     done(client);
//     console.error('query error: ', err);
//     return true;
// };

function calcTokenExpiresDate(expiresIn) {
  var date = new Date();
  return new Date(date.getTime() + (expiresIn - 60) * 1000);
}

function isAccessTokenExpired(token) {
  var expiresOn = +new Date(token.expires);
  var now = +new Date();
  return expiresOn > now;
}

function insertToken(client, instance, tokens, provider, callback) {
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

  client.query(query, values, function (err, result) {
    if (err) { console.error('tokens insert error: ', err); }

    callback(err, result);
  });
}

function getToken(client, instance, provider, callback) {
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
    if (err) { console.error('get token error: ', err); }
    callback(err, result.rows[0]);
  });
}


function updateToken(client, instance, tokens, provider, callback) {

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
    if (err) { console.error('token update error: ', err); }

    callback(err, result.rows[0]);
  });
}

function deleteToken(client, instance, provider, callback) {
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
    if (err) { console.error('delete token error: ', err); }
    if (err) {
      callback(err, undefined);
    } else {
      callback(err, result.rows[0]);
    }
  });
}

function insertWidgetSettings(client, instance, widgetSettings, callback) {
  var query = 'INSERT INTO widget_settings (instance_id, component_id, settings, user_email, curr_provider, updated, created) \
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())';
  var values = [
    instance.instanceId,
    instance.compId,
    widgetSettings.settings,
    widgetSettings.userEmail,
    widgetSettings.provider
  ];
  client.query(query, values, function (err, result) {
    if (err) { console.error('settings insert error: ', err); }

    callback(err, result);
  });
}

function updateWidgetSettings(client, instance, widgetSettings, callback) {
  var query = 'UPDATE widget_settings \
               SET settings = COALESCE($1, settings), \
                   user_email = COALESCE($2, user_email), \
                   curr_provider = COALESCE($3, curr_provider), \
                   updated = NOW() \
               WHERE instance_id = $4 \
               AND component_id = $5 \
               RETURNING *';
  var values = [
    widgetSettings.settings,
    widgetSettings.userEmail,
    widgetSettings.provider,
    instance.instanceId,
    instance.compId
  ];
  client.query(query, values, function (err, result) {
    if (err) { console.error('settings update error: ', err); }

    if (err) {
      callback(err, undefined);
    } else {
      callback(err, result.rows[0]);
    }
  });
}

function getWidgetSettings(client, instance, callback) {
  var query = 'SELECT settings, user_email, curr_provider \
               FROM widget_settings \
               WHERE instance_id = $1 \
               AND component_id = $2 \
               LIMIT 1';
  var values = [
    instance.instanceId,
    instance.compId
  ];
  client.query(query, values, function (err, result) {
    if (err) { console.error('get settings error: ', err); }
    callback(err, result.rows[0]);
  });
}


module.exports = {
  getToken: getToken,
  insertToken: insertToken,
  updateToken: updateToken,
  deleteToken: deleteToken,
  insertWidgetSettings: insertWidgetSettings,
  updateWidgetSettings: updateWidgetSettings,
  getWidgetSettings: getWidgetSettings,
  isAccessTokenExpired: isAccessTokenExpired,
  session: session,
  files: files
};
