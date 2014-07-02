'use strict';

var fs = require('fs');
var googleapis = require('googleapis');
var async = require('async');
var httpStatus = require('http-status');
var user = require('./user.js');
var config = require('../config.js');
var OAuth2 = googleapis.auth.OAuth2;
var googleKeys = require('../config.js').auth.google;
var utils = require('../utils.js');
var request = require('request');


var error = utils.error;
var requestService = utils.requestService;

// google drive specific constants
var ROOT_URL = 'https://www.googleapis.com/';
var DRIVE_API_PATH = 'upload/drive/v2/files';
var DRIVE_ABOUT_PATH = 'drive/v2/about';


/**
 * Checks if upload status code is recoverable
 * @param  {number} statusCode status code to check
 * @return {Boolean}
 */
function shouldRecover(statusCode) {
  var recoverWhenStatus = [500, 501, 502, 503];
  return recoverWhenStatus.indexOf(statusCode) > -1;
}

/**
 * Constructs url
 * @param  {String} root root of url
 * @param  {String} path path to the source
 * @return {String}      attached together root and path
 */
function constructUrl(root, path) {
  path = (path.charAt(0) === '/') ? path.substr(1) : path;
  return root + path;
}

/**
 * Creates a client for googleapis
 * @param  {String} accessToken if supplied, sets to credentials
 * @return {Object}             oauth2 google client
 */
var createOauth2Client = module.exports.createOauth2Client = function (accessToken) {
  var oauth2Client = new OAuth2(googleKeys.clientId, googleKeys.clientSecret);
  if (arguments.length === 1) {
    oauth2Client.setCredentials({
      access_token: accessToken
    });
  }

  return oauth2Client;
};


/**
 * Gets available quota on Google Drive
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}
 * @return {number}               free quota
 */
module.exports.getAvailableCapacity = function (accessToken, callback) {

  var oauth2Client = createOauth2Client(accessToken);

  googleapis.discover('drive', 'v2').execute(function (err, client) {
    if (err) {
      return callback(err, null);
    }
    client
      .drive
      .about
      .get()
      .withAuthClient(oauth2Client)
      .execute(function (err, result) {
        if (err) {
          if (err.code === 401) {
            return callback(error('invalid access token', 401), null);
          }
          return callback(err, null);
        }
        var totalQuota = parseInt(result.quotaBytesTotal, 10);
        var usedQuota = parseInt(result.quotaBytesUsedAggregate, 10);
        callback(null, totalQuota - usedQuota);

      });
  });
};

/**
 * Creates folder on Google Drive with name 'Wix Send Files'
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}
 * @return {String}               id of the folder created
 */
module.exports.createFolder = function (accessToken, callback) {

  var oauth2Client = createOauth2Client(accessToken);

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
};

/**
 * Gets url for resumable upload to Google Drive
 * @param  {Object}   file        file object
 * @param  {String}   folderId    id of a folder to insert
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}
 * @return {String}               upload url
 */
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
    url: constructUrl(ROOT_URL, DRIVE_API_PATH),
    method: 'POST',
    headers: {
      'X-Upload-Content-Type': file.mimetype,
      'X-Upload-Content-Length': file.size,
      'Authorization': 'Bearer ' + accessToken
    },
    qs: params,
    body: fileDesc,
    json: true
  };


  requestService(options, function (err, res) {

    if (err) {
      return callback(err, null);
    }

    if (res.statusCode !== httpStatus.OK) {
      return callback(error(res.body, httpStatus.INTERNAL_SERVER_ERROR), null);
    }

    var uploadUrl = res.headers.location;
    callback(null, uploadUrl);
  });
}

/**
 * Parse range header value to get byte to start uploading from
 * @param  {String} range header value of format 0 - 24
 * @return {number}       byte to start upload from
 */
function getStartUploadFrom(range) {
  var startFrom = 0;
  if (range) {
    startFrom = parseInt(range.split('-')[1], 10) + 1;
  }
  return startFrom;
}

/**
 * Request how much of file has been uploaded.
 * @param  {Object}   file        file object
 * @param  {String}   uploadUrl   url to upload
 * @param  {String}   accessToken
 * @param  {number}   waitFor     number of milliseconds to wait before request
 * @param  {Function} callback
 * @return {Error}
 * @return {number}   byte to start upload form
 * @return {number}   response status code
 */
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
    requestService(options, function (err, res) {

      if (err) {
        console.error('requestUploadStatus error:', err);
        return callback(err, 0, res.statusCode);
      }

      console.log('upload status headers: ', res.headers);
      var rangeHeader = res.headers['range'];

      if (res.statusCode === 308 && rangeHeader) { // Resume Incomplete
        callback(null, getStartUploadFrom(rangeHeader), res.statusCode);
      } else if (shouldRecover(res.statusCode)) {
        // restart upload from zero
        callback(null, 0, res.statusCode);
      } else {
        callback(error(res.body, httpStatus.INTERNAL_SERVER_ERROR), 0, res.statusCode);
      }
    });
  }, waitFor);
}

/**
 * Recovers upload to Google Drive.
 * If Drive unavailable, retries with exponential wait time up to 16 seconds.
 * @param  {Object}   file        file object
 * @param  {String}   uploadUrl   url to upload
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}
 * @return {number}   byte to recover from
 */
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
        callback(error(res.body, httpStatus.INTERNAL_SERVER_ERROR), 0);
      }
    }
  );
}


/**
 * Uploads file to Google Drive.
 * @param  {Object}   file        file object
 * @param  {Strign}   uploadUrl   url to upload
 * @param  {String}   accessToken
 * @param  {number}   start       byte to upload from
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}               response body
 * @return {Boolean}              whether to recover upload or not
 */
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

      if (err) {
        console.error('request for upload to Google Drive error: ', err);
        return callback(err, null, false); // might also set to true, should monitor this
      }

      var body = JSON.parse(res.body);
      console.log(body);
      if (res.statusCode === httpStatus.OK || res.statusCode === httpStatus.CREATED) {
        return callback(null, body, false);
      }

      console.log('google uploaded status code: ', res.statusCode);

      // might be an issue with 308 status code, hasn't been able to replicate

      if (shouldRecover(res.statusCode)) {
        callback(new Error('upload to Google Drive was interrupted'), null, true);
      } else {
        callback(error(res.body, httpStatus.INTERNAL_SERVER_ERROR), null, false);
      }
    }));
  });

  readStream.on('error', function (err) {
    callback(err, null, false);
  });
}

/**
 * Public method for uploading Google Drive and recovering on interrupt.
 * Maximum number of recovers is MAX_UPLOAD_RECOVERS.
 * @param  {Object}   file        file object
 * @param  {String}   folderId    id of folder to insert
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}               response body object on success
 */
module.exports.insertFile = function (file, folderId, accessToken, callback) {

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
};
