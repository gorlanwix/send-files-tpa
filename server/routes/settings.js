'use strict';

// /api/settings/* routes

var db = require('../controllers/pg-database.js');
var utils = require('../utils.js');

var httpStatus = require('http-status');
var validator = require('validator');

var error = utils.error;
var WidgetSettings = utils.WidgetSettings;


module.exports = function (router) {

  router.get('/:compId', function (req, res) {

    db.widget.getSettings(req.widgetIds, function (err, widgetSettings) {

      var settingsResponse = {
        userEmail: '',
        provider: '',
        settings: {}
      };

      if (widgetSettings) {
        settingsResponse.userEmail = widgetSettings.user_email;
        settingsResponse.provider = widgetSettings.curr_provider;
        settingsResponse.settings = widgetSettings.settings;
      }

      res.status(httpStatus.OK);
      res.json({widgetSettings: settingsResponse, status: httpStatus.OK});
    });
  });


  router.put('/:compId', function (req, res, next) {

    var widgetSettings = req.body.widgetSettings;
    var userEmail = widgetSettings.userEmail;
    var isValidSettings = widgetSettings && userEmail !== undefined &&
                          (userEmail.trim() === '' ||
                           validator.isEmail(userEmail)) &&
                          typeof widgetSettings.settings === 'object';

    if (!isValidSettings) {
      return next(error('invalid request format', httpStatus.BAD_REQUEST));
    }

    var settingsRecieved = new WidgetSettings(userEmail, null, widgetSettings.settings, null);
    db.widget.updateSettings(req.widgetIds, settingsRecieved, function (err, updatedWidgetSettings) {
      if (!updatedWidgetSettings) {
        db.widget.insertSettings(req.widgetIds, settingsRecieved, function (err) {
          if (err) {
            return next(error('cannot insert settings', httpStatus.INTERNAL_SERVER_ERROR));
          }

          res.status(httpStatus.CREATED);
          res.json({status: httpStatus.CREATED});
        });
      } else {

        res.status(httpStatus.CREATED);
        res.json({status: httpStatus.CREATED});
      }
    });
  });

  return router;
};