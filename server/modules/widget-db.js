'use strict';

function insertSettings(client, instance, widgetSettings, callback) {
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

function updateSettings(client, instance, widgetSettings, callback) {
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

function getSettings(client, instance, callback) {
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
  getSettings: getSettings,
  insertSettings: insertSettings,
  updateSettings: updateSettings
};