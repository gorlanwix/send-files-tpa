'use strict';


var ChunkedStream = require('./chunked-input-stream.js');
var dropboxKeys = require('../config.js').auth.dropbox;
var utils = require('../utils.js');

var request = require('request');
var httpStatus = require('http-status');
var fs = require('fs');
var error = utils.error;

var maxSize = 10 * 1024 * 1024; //10mb

var DROPBOX_API_ROOT = 'https://api.dropbox.com/1/';


function getResponseError(statusCode) {
  if (statusCode === 401) {
    return error('invalid access token', httpStatus.UNAUTHORIZED);
  }

  return error('service unavailable', httpStatus.INTERNAL_SERVER_ERROR);
}


module.exports.getAvailableCapacity = function (accessToken, callback) {
  var options = {
    url: DROPBOX_API_ROOT + 'account/info',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
  };

  request(options, function (err, res) {
    // for some reason it recieves unparsed res.body
    var body = JSON.parse(res.body);

    if (err) {
      console.error('request for capacity error', err);
      return callback(err, null);
    }

    if (res.statusCode !== httpStatus.OK) {
      console.error('request error body: ', body);
      return callback(getResponseError(res.statusCode), null);
    }
    var quota = body.quota_info;
    callback(null, quota.quota - quota.normal);
  });
};

function commitChunkedUpload(file, accessToken, uploadId, callback) {
  var options = {
    url:  'https://api-content.dropbox.com/1/commit_chunked_upload/sandbox/' + file.originalname,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    qs: {
      upload_id: uploadId,
      overwrite: false
    }
  };

  request(options, function (err, res, body) {
    callback(err, JSON.parse(res.body));
  });
}


function uploadFile(file, accessToken, start, callback) {

  var readStream;
  if (start > 0) { // don't start from zeros byte
    readStream = fs.createReadStream(file.path, { start: start, end: file.size - 1 });
    // options.headers['Content-Range'] = 'bytes ' + start + '-' + (file.size - 1) + '/' + file.size - 1;
  } else { // start from zeros byte
    readStream = fs.createReadStream(file.path);
  }

  var chunkedStream = new ChunkedStream(readStream, maxSize);

  // just wanted to say that dropbox is stupid for not supporting streaming
  function uploadChunk(uploadId, offset) {

    var options = {
      url: 'https://api-content.dropbox.com/1/chunked_upload',
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    };

    if (uploadId) {
      options.qs = {
        upload_id: uploadId,
        offset: offset
      }
    }

    return request(options, function (err, res) {
      var body = JSON.parse(res.body);

      console.log('res: ', body);

      if (chunkedStream.actuallyEnded) {
        // /commit_chunked_upload
        console.log('commiting upload');
        commitChunkedUpload(file, accessToken, body.upload_id, callback);
      } else {
        // start the next chunk rolling.
        chunkedStream.pipe(uploadChunk(body.upload_id, chunkedStream.bytesWritten + 1));
        // resume() sends any rollover data.
        chunkedStream.resume();
      }

    });
  }

  readStream.on('open', function () {
    chunkedStream.pipe(uploadChunk(null, 0));
  });

  readStream.on('error', function (err) {
    callback(err, null);
  });
  //   readStream.pipe();request(options, function (err, res) {
  //     var body = JSON.parse(res.body);

  //     if (err) {
  //       console.error('request for upload to Google Drive error: ', err);
  //       return callback(err, null, false); // might also set to true, should monitor this
  //     }

  //     if (res.statusCode === httpStatus.OK || res.statusCode === httpStatus.CREATED) {
  //       return callback(null, body, false);
  //     }

  //     console.log('google uploaded status code: ', res.statusCode);

  //     // might be an issue with 308 status code, hasn't been able to replicate

  //     var recoverWhenStatus = [500, 501, 502, 503];

  //     var shouldRecover = recoverWhenStatus.indexOf(res.statusCode) > -1;

  //     if (shouldRecover) {
  //       callback(new Error('upload to Google Drive was interrupted'), null, true);
  //     } else {
  //       callback(new Error('cannot upload to google drive'), null, false);
  //     }
  //   }));
  // });
}


module.exports.insertFile = function (file, accessToken, callback) {

  console.log('insering file to dropbox');

  uploadFile(file, accessToken, 0, function (err, result) {

    return callback(err, result);
    // if (result) {
    //   return callback(null, result);
    // }

    // if (!isRecoverable) {
    //   console.error('cannot recover on the first try');
    //   return callback(new Error('upload to dropbox Drive is not recoverable'), null);
    // }

    // console.log('recovering dropbox upload');

    // // otherwise try to recover
    // var shouldRecover = true;
    // var numRecoversTries = 0;
    // var responseBody = result;
    // async.whilst(
    //   function () {
    //     return shouldRecover && numRecoversTries < config.MAX_UPLOAD_RECOVERS;
    //   },
    //   function (callback) {
    //     recoverUpload(file, uploadUrl, accessToken, function (err, startUploadFrom) {
    //       if (err) {
    //         return callback(err);
    //       }
    //       uploadFile(file, uploadUrl, accessToken, startUploadFrom, function (err, result, isRecoverable) {
    //         responseBody = result;
    //         shouldRecover = isRecoverable;
    //         numRecoversTries++;
    //         callback(null);
    //       });
    //     });
    //   },
    //   function (err) {
    //     if (err) {
    //       console.error('dropbox recover upload error: ', err);
    //       return callback(err, null);
    //     }

    //     if (responseBody) {
    //       console.log('successfully recovered dropbox upload: ', responseBody);
    //       callback(null, responseBody);
    //     } else if (shouldRecover) {
    //       console.error('exceeded number of recovers to dropbox');
    //       callback(new Error('cannot upload to dropbox drive, exceeded number of recovers'), null);
    //     } else {
    //       callback(new Error('cannot upload to dropbox drive'), null);
    //     }
    //   }
    // );
  });
};