'use strict';

var handleError = function(client, done, err) {
    // no error occurred, continue with the request
    if(!err) return false;

    done(client);
    console.error('query error: ', err);
    return true;
};

function insertTokens(client, widgetId, tokens, callback) {
    client.query('INSERT INTO oauth_token (widget_id, access_token, refresh_token, token_type, expires, created) \
        VALUES ($1, $2, $3, $4, $5, NOW())',
        [widgetId, tokens.access_token, tokens.refresh_token, tokens.token_type, getExpiresDate(tokens.expires_in)],
        function (err, result) {
            if(err) console.error('tokens insert error: ', err);

            callback(result);
        });
}

function insertWidget(client, instanceId, componentId, callback) {
    client.query(
        'INSERT INTO widget (instance_id, component_id, created) VALUES ($1, $2, NOW()) RETURNING widget_id',
        [instanceId, componentId],
        function(err, result) {
            if(err) console.error('widget insert error: ', err);

            callback(result);
        });
}

function getAccessToken(client, instanceId, componentId, callback) {
    client.query(
        'SELECT access_token, refresh_token, expires \
         FROM widget, oauth_token \
         WHERE widget.widget_id = oauth_token.widget_id AND instance_id = $1 AND component_id = $2 LIMIT 1',
        [instanceId, componentId],
        function(err, result) {
            if(err) console.error('token get error: ', err);

            callback(result);
        });
}


function updateAccessToken(client, accessToken, instanceId, componentId, callback) {
    client.query(
        'UPDATE oauth_token \
         SET access_token = $1 \
         FROM widget \
         WHERE widget.widget_id = oauth_token.widget_id AND instance_id = $2 AND component_id = $3',
        [accessToken, instanceId, componentId],
        function(err, result) {
            if(err) console.error('token update error: ', err);

            callback(result);
        });
}


function getExpiresDate(expires_in) {
    var date = new Date();
    var dateMillis = date.getTime();
    return new Date(dateMillis + (expires_in - 60) * 1000);
}

module.exports = {
    insertWidget: insertWidget,
    insertTokens: insertTokens,
    getAccessToken: getAccessToken,
    updateAccessToken: updateAccessToken
}
