'use strict';

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

function insertToken(client, widgetId, tokens, callback) {
  var query = 'INSERT INTO oauth_token (widget_id, id_token, access_token, refresh_token, token_type, expires, created) \
               VALUES ($1, $2, $3, $4, $5, $6, NOW())';
  var values = [
    widgetId,
    tokens.id_token,
    tokens.access_token,
    tokens.refresh_token,
    tokens.token_type,
    calcTokenExpiresDate(tokens.expires_in)
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('tokens insert error: ', err); }

    callback(result);
  });
}

function insertWidget(client, instanceId, componentId, callback) {
  var query = 'INSERT INTO widget (instance_id, component_id, created) VALUES ($1, $2, NOW()) \
               RETURNING widget_id';
  var values = [
    instanceId,
    componentId,
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('widget insert error: ', err); }

    callback(result.rows[0].widget_id);
  });
}

function getToken(client, instanceId, componentId, callback) {
  var query = 'SELECT access_token, refresh_token, expires, id_token \
               FROM widget, oauth_token \
               WHERE widget.widget_id = oauth_token.widget_id \
               AND instance_id = $1 \
               AND component_id = $2 LIMIT 1';
  var values = [
    instanceId,
    componentId
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('get token error: ', err); }

    callback(result.rows[0]);
  });
}


function updateToken(client, tokens, instanceId, componentId, callback) {
  var query = 'UPDATE oauth_token, id_token \
               SET access_token =  $1, refresh_token = $2, id_token = $3, expires = $4 \
               FROM widget \
               WHERE widget.widget_id = oauth_token.widget_id \
               AND instance_id = $5 \
               AND component_id = $6';
  var values = [
    tokens.access_token,
    tokens.refresh_token,
    tokens.id_token,
    calcTokenExpiresDate(tokens.expires_in),
    instanceId,
    componentId
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('token update error: ', err); }

    callback(result);
  });
}

function deleteToken(client, instanceId, componentId, callback) {
  var query = 'DELETE FROM oauth_token \
               USING widget \
               WHERE widget.widget_id = oauth_token.widget_id \
               AND instance_id = $1 \
               AND component_id = $2 \
               RETURNING *';
  var values = [
    instanceId,
    componentId
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('delete token error: ', err); }
    if (err) {
      callback(undefined);
    } else {
      callback(result.rows[0])
    }
  });
}


function getWidgetId(client, instanceId, componentId, callback) {
  var query = 'SELECT widget_id \
               FROM widget \
               WHERE instance_id = $1 AND component_id = $2 LIMIT 1';
  var values = [
    instanceId,
    componentId
  ];

  client.query(query, values, function (err, result) {
    if (err) { console.error('get widget error: ', err); }

    if(result.rows[0] === undefined) {
      callback(undefined);
    } else {
      callback(result.rows[0].widget_id);
    }
  });
}

module.exports = {
  insertWidget: insertWidget,
  getToken: getToken,
  insertToken: insertToken,
  updateToken: updateToken,
  deleteToken: deleteToken,
  getWidgetId: getWidgetId
};
