'use strict';

var fs = require('fs');
var googleapis = require('googleapis');
var qs = require('querystring');
var request = require('request');
var async = require('async');
var httpStatus = require('http-status');
var userAuth = require('./user-auth.js');
var config = require('../config.js');
var OAuth2 = googleapis.auth.OAuth2;
var googleKeys = require('../config.js').googleKeys;

// google drive specific constants
var ROOT_URL = 'https://www.googleapis.com/';
var DRIVE_API_PATH = 'upload/drive/v2/files';
var DRIVE_ABOUT_PATH = 'drive/v2/about';


function createOauth2Client(tokens) {
  var oauth2Client = new OAuth2(googleKeys.clientId, googleKeys.clientSecret, googleKeys.redirectUri);
  if (arguments.length === 1) {
    oauth2Client.credentials = tokens;
  }

  return oauth2Client;
}

function constructUrl(root, path, params) {
  var paramsString = '';
  if (params) {
    paramsString = '?' + qs.stringify(params);
  }
  path = (path.charAt(0) === '/') ? path.substr(1) : path;
  return root + path + paramsString;
}

function getAvailableCapacity(accessToken, callback) {
  var options = {
    url: constructUrl(ROOT_URL, DRIVE_ABOUT_PATH, null),
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
  };

  request(options, function (err, res, test) {
    // for some reason it recieves unparsed res.body
    var body = JSON.parse(res.body);

    if (err) {
      console.error('request for capacity error', err);
      return callback(err, null);
    }

    if (res.statusCode !== httpStatus.OK) {
      console.error('request error body: ', body);
      var errorMessage = 'Cannot retrieve Google Drive capacity: ' +
                          body.error.code + ' ' +
                          body.error.messsage;
      return callback(new Error(errorMessage), null);
    }

    var totalQuota = parseInt(body.quotaBytesTotal, 10);
    var usedQuota = parseInt(body.quotaBytesUsedAggregate, 10);
    callback(null, totalQuota - usedQuota);
  });
}

// returns id of the folder
function createFolder(accessToken, callback) {

  var oauth2Client = createOauth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken
  });

  var folder = {
    title: 'Wix Send Files',
    mimeType: 'application/vnd.google-apps.folder'
  };

  googleapis.discover('drive', 'v2').execute(function (err, client) {
    if (err) {
      return callback(err, null);
    }
    client
      .drive.files.insert(folder)
      .withAuthClient(oauth2Client)
      .execute(function (err, result) {
        if (err) {
          return callback(err, null);
        }

        callback(null, result.id);
      });
  });
}


function getUploadUrl(file, folderId, accessToken, callback) {
  var fileDesc = {
    title: file.originalname,
    mimeType: file.mimetype,
    parents: [{
      kind: 'drive#fileLink',
      id: folderId
    }]
  };

  var params = { uploadType: 'resumable' };

  var options = {
    url: constructUrl(ROOT_URL, DRIVE_API_PATH, params),
    method: 'POST',
    headers: {
      'X-Upload-Content-Type': file.mimetype,
      'X-Upload-Content-Length': file.size,
      'Authorization': 'Bearer ' + accessToken
    },
    body: fileDesc,
    json: true
  };


  request(options, function (err, res) {

    var body = res.body;

    if (err) {
      console.error('request error', err);
      return callback(err, null);
    }

    if (res.statusCode !== httpStatus.OK) {
      console.error('request error body: ', body);
      var errorMessage = 'Cannot retrieve Google Drive upload URL: ' +
                          body.error.code + ' ' +
                          body.error.messsage;
      return callback(new Error(errorMessage), null);
    }

    var uploadUrl = res.headers.location;
    callback(null, uploadUrl);
  });
}

function getStartUploadFrom(range) {
  var startFrom = 0;
  if (range) {
    startFrom = parseInt(range.split('-')[1], 10) + 1;
  }
  return startFrom;
}

function requestUploadStatus(file, uploadUrl, accessToken, waitFor, callback) {
  var options = {
    url: uploadUrl,
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Range': 'bytes */' + file.size
    }
  };

  console.log('requesting upload status, waiting for ' + waitFor);

  setTimeout(function () {
    request(options, function (err, res) {

      if (err) {
        console.error('requestUploadStatus error:', err);
        return callback(err, 0, res.statusCode);
      }
      console.log('upload status headers: ', res.headers);
      var rangeHeader = res.headers['range'];

      if (res.statusCode === 308 && rangeHeader) { // Resume Incomplete
        callback(null, getStartUploadFrom(rangeHeader), res.statusCode);
      } else {
        // restart upload from zero
        callback(null, 0, res.statusCode);
      }
    });
  }, waitFor);
}


function recoverUpload(file, uploadUrl, accessToken, callback) {
  var watingTimes = [0, 1000, 2000, 4000, 8000, 16000];
  var startFrom = 0;
  var requestCount = 0;
  var statusCode = httpStatus.SERVICE_UNAVAILABLE;
  var isError = false;
  async.whilst(
    function () {
      return statusCode !== 308 && requestCount < watingTimes.length && !isError;
    },
    function (callback) {
      requestUploadStatus(file, uploadUrl, accessToken, watingTimes[requestCount], function (err, restartFrom, newStatusCode) {
        if (err) {
          isError = true;
          return callback(err);
        }
        startFrom = restartFrom;
        statusCode = newStatusCode;
        requestCount++;
        callback(null);
      });
    },
    function (err) {
      if (err) {
        return callback(err, 0);
      }
      if (statusCode === 308) {
        callback(null, startFrom);
      } else {
        callback(new Error('cannot recover upload to Google Drive'), 0);
      }
    }
  );
}


// returns error, response body, and a boolean of whether it should be recovered
function uploadFile(file, uploadUrl, accessToken, start, callback) {

  var options = {
    url: uploadUrl,
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    }
  };

  var readStream;
  if (start > 0) { // don't start from zeros byte
    readStream = fs.createReadStream(file.path, { start: start, end: file.size - 1 });
    options.headers['Content-Range'] = 'bytes ' + start + '-' + (file.size - 1) + '/' + file.size - 1;
  } else { // start from zeros byte
    readStream = fs.createReadStream(file.path);
  }

  readStream.on('open', function () {
    readStream.pipe(request(options, function (err, res) {
      var body = res.body;

      if (err) {
        console.error('request for upload to Google Drive error: ', err);
        return callback(err, null, false); // might also set to true, should monitor this
      }

      if (res.statusCode === httpStatus.OK || res.statusCode === httpStatus.CREATED) {
        return callback(null, body, false);
      }

      console.log('google uploaded status code: ', res.statusCode);

      // might be an issue with 308 status code, hasn't been able to replicate

      var recoverWhenStatus = [500, 501, 502, 503];

      var shouldRecover = recoverWhenStatus.indexOf(res.statusCode) > -1;

      if (shouldRecover) {
        callback(new Error('upload to Google Drive was interrupted'), null, true);
      } else {
        callback(new Error('cannot upload to google drive'), null, false);
      }
    }));
  });

  readStream.on('error', function (err) {
    callback(err, null, false);
  });
}

// returns error and parsed result of insertion
function insertFile(file, folderId, accessToken, callback) {

  console.log('insering file to google');
  getUploadUrl(file, folderId, accessToken, function (err, uploadUrl) {
    if (err) {
      console.error('google request for upload url error: ', err);
      return callback(err, null);
    }

    uploadFile(file, uploadUrl, accessToken, 0, function (err, result, isRecoverable) {

      if (result) {
        return callback(null, result);
      }

      if (!isRecoverable) {
        console.error('cannot recover on the first try');
        return callback(new Error('upload to Google Drive is not recoverable'), null);
      }

      console.log('recovering google upload');

      // otherwise try to recover
      var shouldRecover = true;
      var numRecoversTries = 0;
      var responseBody = result;
      async.whilst(
        function () {
          return shouldRecover && numRecoversTries < config.MAX_UPLOAD_RECOVERS;
        },
        function (callback) {
          recoverUpload(file, uploadUrl, accessToken, function (err, startUploadFrom) {
            if (err) {
              return callback(err);
            }
            uploadFile(file, uploadUrl, accessToken, startUploadFrom, function (err, result, isRecoverable) {
              responseBody = result;
              shouldRecover = isRecoverable;
              numRecoversTries++;
              callback(null);
            });
          });
        },
        function (err) {
          if (err) {
            console.error('google recover upload error: ', err);
            return callback(err, null);
          }

          if (responseBody) {
            console.log('successfully recovered google upload: ', responseBody);
            callback(null, responseBody);
          } else if (shouldRecover) {
            console.error('exceeded number of recovers to google');
            callback(new Error('cannot upload to google drive, exceeded number of recovers'), null);
          } else {
            callback(new Error('cannot upload to google drive'), null);
          }
        }
      );
    });
  });
}


module.exports = {
  insertFile: insertFile,
  getAvailableCapacity: getAvailableCapacity,
  createFolder: createFolder,
  createOauth2Client: createOauth2Client
};
