'use strict';

// /auth/* routes

var userAuth = require('../controllers/user-auth.js');
var db = require('../controllers/pg-database.js');
var googleDrive = require('../controllers/google-drive.js');
var utils = require('../utils.js');


var httpStatus = require('http-status');


var error = utils.error;
var WidgetSettings = utils.WidgetSettings;
var WixWidget = utils.WixWidget;

var express = require('express');


module.exports.setParamsIfNotLoggedIn = function (params) {
  return function (req, res, next) {
    db.token.get(req.widgetIds, function (err, tokensFromDb) {
      if (!tokensFromDb) {
        params.state = req.widgetIds.instanceId + '+' + req.widgetIds.compId;
        next();
      } else {
        next(error('already connected with ' + tokensFromDb.provider, httpStatus.BAD_REQUEST));
      }
    });
  };
};

module.exports.logout = function (req, res, next) {

  userAuth.disconnectUser(req.widgetIds, function (err, removedTokens) {
    if (!removedTokens) {
      return next(error('account is not connect', httpStatus.BAD_REQUEST));
    }

    if (err) {
      return next(error('account disconnect error', httpStatus.INTERNAL_SERVER_ERROR));
    }

    userAuth.revokeAccess(removedTokens, function (err) {
      if (err) {
        console.error('token revoking error', err);
        return next(error('token revoking error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      res.status(httpStatus.OK);
      res.json({status: httpStatus.OK});
    });
  });
};
