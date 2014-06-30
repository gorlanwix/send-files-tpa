'use strict';

// /api/settings/* routes

var db = require('../models/pg-database.js');
var utils = require('../utils.js');

var httpStatus = require('http-status');
var validator = require('validator');

var error = utils.error;
var WidgetSettings = db.widget.WidgetSettings;

/**
 * Get widget settings in the following format:
 * {
 *   widgetSettings: {
 *     provider: "",
 *     settings: {},
 *     userProfile: {},
 *   },
 *   status: ""
 * }
 */
module.exports.get = function (req, res, next) {

  db.widget.getSettings(req.widgetIds, function (err, widgetSettings) {

    if (err) {
      return error('cannot get settings', httpStatus.INTERNAL_SERVER_ERROR);
    }

    var settingsResponse = {
      provider: '',
      settings: {}
    };

    if (widgetSettings) {
      settingsResponse.provider = widgetSettings.curr_provider;
      settingsResponse.settings = widgetSettings.settings;
      if (req.query.userProfile === 'true') { // watch out, might be not a string
        settingsResponse.userProfile = widgetSettings.user_profile;
      }
    }

    res.status(httpStatus.OK);
    res.json({widgetSettings: settingsResponse, status: httpStatus.OK});
  });
};

/**
 * Put widget settings in the following format:
 * {
 *   widgetSettings: {
 *     settings: {}
 *   }
 * }
 */
module.exports.put = function (req, res, next) {

  var widgetSettings = req.body.widgetSettings;
  var isValidSettings = widgetSettings &&
                        typeof widgetSettings.settings === 'object';

  if (!isValidSettings) {
    return next(error('invalid request format', httpStatus.BAD_REQUEST));
  }

  var settingsRecieved = new WidgetSettings(null, null, widgetSettings.settings, null);
  db.widget.updateOrInsertSettings(req.widgetIds, settingsRecieved, function (err) {
    if (err) {
      return next(error('cannot save settings', httpStatus.INTERNAL_SERVER_ERROR));
    }

    res.status(httpStatus.CREATED);
    res.json({status: httpStatus.CREATED});
  });
};
