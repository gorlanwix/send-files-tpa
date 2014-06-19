'use strict';

var query = require('../config.js').query;

function insertSettings(instance, widgetSettings, callback) {
  var q = 'INSERT INTO widget_settings (instance_id, component_id, settings, service_settings, user_email, curr_provider, updated, created) \
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())';
  var values = [
    instance.instanceId,
    instance.compId,
    widgetSettings.settings,
    widgetSettings.serviceSettings,
    widgetSettings.userEmail,
    widgetSettings.provider
  ];
  query(q, values, function (err, rows, result) {
    if (err) {
      console.error('settings insert error: ', err);
      return callback(err);
    }

    callback(null);
  });
}

function updateSettings(instance, widgetSettings, callback) {
  var q = 'UPDATE widget_settings \
           SET settings = COALESCE($1, settings), \
               service_settings = COALESCE($2, service_settings),
               user_email = COALESCE($3, user_email), \
               curr_provider = COALESCE($4, curr_provider), \
               updated = NOW() \
           WHERE instance_id = $5 \
           AND component_id = $6 \
           RETURNING *';
  var values = [
    widgetSettings.settings,
    widgetSettings.serviceSettings,
    widgetSettings.userEmail,
    widgetSettings.provider,
    instance.instanceId,
    instance.compId
  ];
  query.first(q, values, function (err, rows, result) {

    if (err) {
      console.error('settings update error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}

function getSettings(instance, callback) {
  var q = 'SELECT settings, service_settings, user_email, curr_provider \
           FROM widget_settings \
           WHERE instance_id = $1 \
           AND component_id = $2 \
           LIMIT 1';
  var values = [
    instance.instanceId,
    instance.compId
  ];
  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('settings update error: ', err);
      return callback(err, null);
    }

    callback(null, rows);
  });
}

module.exports = {
  getSettings: getSettings,
  insertSettings: insertSettings,
  updateSettings: updateSettings
};