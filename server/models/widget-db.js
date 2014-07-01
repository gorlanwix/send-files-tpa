'use strict';

var query = require('../config.js').query;

/**
 * Constructor for WidgetSettings.
 * Set a param to null in order to not update it
 * @param {Object} profile         service account info
 * @param {String} provider        current service name
 * @param {Object} settings        widget settings
 * @param {Object} serviceSettings service specific settings
 */
var WidgetSettings = module.exports.WidgetSettings = function (profile, provider, settings, serviceSettings) {
  this.userProfile = profile;
  this.provider = provider;
  this.settings = settings;
  this.serviceSettings = serviceSettings;
};

/**
 * Insert new widget settings
 * @param  {WixWidget}   instance
 * @param  {WidgetSettings}   widgetSettings
 * @param  {Function} callback
 * @return {null}
 */
var insertSettings = module.exports.insertSettings = function (instance, widgetSettings, callback) {
  var q = 'INSERT INTO widget_settings (instance_id, component_id, settings, service_settings, user_profile, curr_provider, updated, created) \
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())';

  var values = [
    instance.instanceId,
    instance.compId,
    widgetSettings.settings,
    widgetSettings.serviceSettings,
    widgetSettings.userProfile,
    widgetSettings.provider
  ];

  query(q, values, function (err, rows, result) {
    if (err) {
      console.error('db settings insert error: ', err);
      return callback(err);
    }

    callback(null);
  });
};

/**
 * Update existing widget settings
 * @param  {WixWidget}   instance
 * @param  {WidgetSettings}   widgetSettings
 * @param  {Function} callback
 * @return {Object} updated settings
 */
var updateSettings = module.exports.updateSettings = function (instance, widgetSettings, callback) {
  var q = 'UPDATE widget_settings \
           SET settings = COALESCE($1, settings), \
               service_settings = COALESCE($2, service_settings), \
               user_profile = COALESCE($3, user_profile), \
               curr_provider = COALESCE($4, curr_provider), \
               updated = NOW() \
           WHERE instance_id = $5 \
           AND component_id = $6 \
           RETURNING *';

  var values = [
    widgetSettings.settings,
    widgetSettings.serviceSettings,
    widgetSettings.userProfile,
    widgetSettings.provider,
    instance.instanceId,
    instance.compId
  ];

  query.first(q, values, callback);
};

/**
 * Updates existing or inserts new settings if do not exist
 * @param  {WixWidget} instance
 * @param  {WidgetSettings} widgetSettings
 * @param  {Function} callback
 * @return {null}
 */
module.exports.updateOrInsertSettings = function (instance, widgetSettings, callback) {
  updateSettings(instance, widgetSettings, function (err, updatedSettings) {
    if (err) {
      return callback(err);
    }
    if (!updatedSettings) {
      insertSettings(instance, widgetSettings, callback);
    } else {
      callback(null);
    }
  });
};

/**
 * Getter for widget settings
 * @param  {WixWidget} instance
 * @param  {Function} callback
 * @return {WidgetSettings|null} null if not found
 */
module.exports.getSettings = function (instance, callback) {
  var q = 'SELECT settings, service_settings, user_profile, curr_provider \
           FROM widget_settings \
           WHERE instance_id = $1 \
           AND component_id = $2 \
           LIMIT 1';

  var values = [
    instance.instanceId,
    instance.compId
  ];

  query.first(q, values, function (err, row, result) {
    if (err) {
      console.error('db settings get error: ', err);
      return callback(err, null);
    }

    if(!row) {
      return callback(null, null);
    }

    var settings = new WidgetSettings(
      row.user_profile,
      row.curr_provider,
      row.settings,
      row.service_settings
    );
    callback(null, settings);
  });
};