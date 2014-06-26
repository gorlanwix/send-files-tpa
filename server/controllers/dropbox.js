'use strict';


var ChunkedStream = require('./chunked-input-stream.js');
var dropboxKeys = require('../config.js').auth.dropbox;
var utils = require('../utils.js');

var request = require('request');
var httpStatus = require('http-status');
var error = utils.error;

// var stream = openInputStream(...);
// var maxSize = 150000000; //150mb
// var chunkedStream = new ChunkedStream(stream, maxSize);

// function newRequest() {
//     return request(uploadUrl, function(err, res, body) {

//         if (chunkedStream.actuallyEnded) {
//             finishUp();
//         } else {
//             // start the next chunk rolling.
//             chunkedStream.pipe(newRequest());
//             // resume() sends any rollover data.
//             chunkedStream.resume();
//         }

//     });
// }

// chunkedStream.pipe(newRequest())


function handleResponseError(statusCode) {
  if (statusCode === 401) {
    return error('invalid access token', httpStatus.UNAUTHORIZED);
  }

  return error('service unavailable', httpStatus.INTERNAL_SERVER_ERROR);
}


module.exports.getAvailableCapacity = function (accessToken, callback) {
  var options = {
    url: 'https://api.dropbox.com/1/account/info',
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
      return callback(handleResponseError(res.statusCode), null);
    }
    var quota = body.quota_info;
    callback(null, quota.quota - quota.normal);
  });
};