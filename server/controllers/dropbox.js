'use strict';


var ChunkedStream = require('./chunked-input-stream.js');
var dropboxKeys = require('../config.js').auth.dropbox;
var utils = require('../utils.js');
var error = utils.error;

var request = require('request');
var httpStatus = require('http-status');
var fs = require('fs');
var getResponseError = utils.getResponseError;

var maxChunkSize = 4 * 1024 * 1024; //10mb

var DROPBOX_API_ROOT = 'https://api.dropbox.com/1/';
var DROPBOX_API_CONTENT = 'https://api-content.dropbox.com/1/';
var requestService = utils.requestService;


/**
 * Gets available quota on Dropbox
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {number}               free quota
 */
module.exports.getAvailableCapacity = function (accessToken, callback) {
  var options = {
    url: DROPBOX_API_ROOT + 'account/info',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
  };

  requestService(options, function (err, res) {
    // for some reason it recieves unparsed res.body

    if (err) {
      console.error('request for capacity error', err);
      return callback(err, null);
    }

    var body = JSON.parse(res.body);
    if (res.statusCode !== httpStatus.OK) {
      console.error('request error body: ', body);
      return callback(error(body, res.statusCode), null);
    }
    var quota = body.quota_info;
    callback(null, quota.quota - quota.normal);
  });
};


/**
 * Finished chunked upload
 * @param  {Object}   file        file object
 * @param  {String}   accessToken
 * @param  {String}   uploadId    id of upload
 * @param  {Function} callback
 * @return {Error}                on failure
 * @return {Object}               response body object on success
 */
function commitChunkedUpload(file, accessToken, uploadId, callback) {
  var options = {
    url: DROPBOX_API_CONTENT + 'commit_chunked_upload/sandbox/' + file.originalname,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    qs: {
      upload_id: uploadId,
      overwrite: false
    }
  };

  requestService(options, function (err, res) {
    if (err) {
      console.error('commiting chunked upload error', err);
      return callback(err, null);
    }

    if (res.statusCode !== httpStatus.OK) {
      console.error('commitChunkedUpload error body: ', res.body);
      return callback(error(res.body, res.statusCode), null);
    }
    callback(err, JSON.parse(res.body));
  });
}

/**
 * Chunked upload to Dropbox.
 * @param  {Object}   file        file object to upload
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}                on failure
 * @return {Object}               response body on success
 */
function uploadFile(file, accessToken, callback) {

  var readStream = fs.createReadStream(file.path);

  var chunkedStream = new ChunkedStream(readStream, maxChunkSize);

  // just wanted to say that dropbox is stupid for not supporting streaming
  function uploadChunk(uploadId, offset) {

    var options = {
      url: DROPBOX_API_CONTENT + 'chunked_upload',
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    };

    if (uploadId) {
      options.qs = {
        upload_id: uploadId,
        offset: offset
      };
    }

    return request(options, function (err, res) {
      var body = JSON.parse(res.body);
      if (res.statusCode !== httpStatus.OK) {
        if (res.statusCode === 401 || res.statusCode === 403) {
          return callback(error('invalid access token', res.statusCode), null);
        }
        return callback(error(res.body, res.statusCode), null);
      }

      if (chunkedStream.actuallyEnded) {
        // /commit_chunked_upload
        console.log('commiting upload');
        commitChunkedUpload(file, accessToken, body.upload_id, callback);
      } else {
        // start the next chunk rolling.
        chunkedStream.pipe(uploadChunk(body.upload_id, chunkedStream.bytesWritten));
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
}

/**
 * Public method for uploading to Dropbox
 * @param  {object}   file        file object
 * @param  {String}   accessToken
 * @param  {Function} callback
 * @return {Error}                on failure
 * @return {Object}               response body on success
 */
module.exports.insertFile = function (file, accessToken, callback) {

  console.log('insering file to dropbox');

  uploadFile(file, accessToken, callback);
};