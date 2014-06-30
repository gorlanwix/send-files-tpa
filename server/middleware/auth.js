'use strict';

// /auth/* routes

var user = require('../controllers/user.js');
var db = require('../models/pg-database.js');
var googleDrive = require('../controllers/google-drive.js');
var utils = require('../utils.js');


var httpStatus = require('http-status');
var error = utils.error;


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

  user.remove(req.widgetIds, function (err, removedTokens) {
    if (!removedTokens) {
      return next(error('account is not connected', httpStatus.BAD_REQUEST));
    }

    if (err) {
      return next(error('account removal error', httpStatus.INTERNAL_SERVER_ERROR));
    }

    user.revokeAccess(removedTokens, function (err) {
      if (err) {
        console.error('token revoking error', err);
        return next(error('token revoking error', httpStatus.INTERNAL_SERVER_ERROR));
      }
      res.status(httpStatus.OK);
      res.json({status: httpStatus.OK});
    });
  });
};
