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


module.exports = function (passport, router) {

  passport.use('google', userAuth.googleStrategy);


  var scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'email'
  ];

  var params =  {
    accessType: 'offline', // will return a refresh token
    approvalPrompt: 'force', // will ask for allowing every time (in case same account but different widgets)
    state: null,
    display: 'popup',
    scope: scopes
  };


  router.use('/', function (req, res, next) {

    var instance = req.query.instance;

    if (instance) {
      var instanceId = null;
      try {
        instanceId = utils.getInstanceId(instance);
      } catch (e) {
        return next(error('invalid instance', httpStatus.UNAUTHORIZED));
      }

      req.widgetIds = new WixWidget(instanceId, null);
    }

    next();
  });

  router.param('compId', function (req, res, next, compId) {
    req.widgetIds.compId = compId;

    next();
  });

  router.get('/login/google/:compId', userAuth.setParamsIfNotLoggedIn(params), passport.authenticate('google', params));

  router.get('/callback/google', passport.authenticate('google', {
    failureRedirect: '/views/verified.html',
    successRedirect: '/views/verified.html',
    session: false
  }));

  router.get('/logout/:compId', function (req, res, next) {

    db.token.remove(req.widgetIds, function (err, removedTokens) {
      if (!removedTokens) {
        return next(error('not logged in', httpStatus.BAD_REQUEST));
      }

      var widgetSettings = new WidgetSettings(null, '', null, null);

      db.widget.updateSettings(req.widgetIds, widgetSettings, function (err) {
        if (err) {
          return next(error('settings update error', httpStatus.INTERNAL_SERVER_ERROR));
        }
        if (removedTokens.provider === 'google') {
          var oauth2Client = googleDrive.createOauth2Client();
          oauth2Client.revokeToken(removedTokens.refresh_token, function (err) {
            if (err) {
              console.error('token revoking error', err);
              return next(error('token revoking error', httpStatus.INTERNAL_SERVER_ERROR));
            }

            res.status(httpStatus.OK);
            res.json({status: httpStatus.OK});
          });
        }
      });
    });
  });

  return router;
};

