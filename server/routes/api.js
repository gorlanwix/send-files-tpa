'use strict';

// /api/* routes

var utils = require('../utils.js');

var httpStatus = require('http-status');

var error = utils.error;
var WixWidget = utils.WixWidget;


module.exports = function (router) {

  router.use('/', function (req, res, next) {

    var instance = req.header('X-Wix-Instance');

    var instanceId = null;
    try {
      instanceId = utils.getInstanceId(instance);
    } catch (e) {
      return next(error('invalid instance', httpStatus.UNAUTHORIZED));
    }

    req.widgetIds = new WixWidget(instanceId, null);
    next();
  });


  router.use('/files', require('./files.js')(router));
  router.use('/settings', require('./settings.js')(router));

  return router;
};