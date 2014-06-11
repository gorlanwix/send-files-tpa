'use strict';

var fs = require('fs');
var googleapis = require('googleapis');
var qs = require('querystring');
var request = require('request');

function constructUrl(root, path, params) {
  var paramsString = '';
  if (params !== undefined) {
    paramsString = '?' + qs.stringify(params);
  }
  path = (path.charAt(0) === '/') ? path.substr(1) : path;
  return root + path + paramsString;
}

function connect(callback) {
  googleapis
      .discover('drive', 'v2')
      .execute(callback);
}


function insertFile(client, oauth2Client, file, callback) {

  var fileDesc = {
    title: file.originalname,
    mimeType: file.mimetype,
  };

  console.log('insering file to google');

  client.drive.files.insert(fileDesc)
    .withMedia(file.mimetype, fs.readFileSync())
    .withAuthClient(oauth2Client)
    .execute(function (err, result) {
      if (err) { console.error('Inserting to Drive error:', err); }
      callback(err, result);
    });
}

function getGoogleUploadUrl(file, oauth2Client, callback) {
  var ROOT_URL = 'https://www.googleapis.com/';
  var DRIVE_API_PATH = 'upload/drive/v2/files';
  var fileDesc = {
    title: file.originalname,
    mimeType: file.mimetype,
  };

  var params = { uploadType: 'resumable' };

  var options = {
    url: constructUrl(ROOT_URL, DRIVE_API_PATH, params),
    method: 'POST',
    headers: {
      'X-Upload-Content-Type': file.mimetype,
      'X-Upload-Content-Length': file.size,
      'Authorization': 'Bearer ' + oauth2Client.credentials.access_token
    },
    body: fileDesc,
    json: true
  };

  request(options, function (err, res, body) {
    if (err) { console.error('request error', err); }

    if (!err && res.statusCode === 200) {
      var uploadUrl = res.headers.location;
      callback(null, uploadUrl);
    } else {
      if (err) {
        callback(err, null);
      } else {
        var errorMessage = 'Cannot retrieve Google Drive upload URL: ' +
                            body.error.code + ' ' +
                            body.error.messsage;
        callback(new Error(errorMessage), null);
      }
    }
  });
}

function uploadFileToGoogle(file, uploadUrl, oauth2Client, callback) {
  var options = {
    url: uploadUrl,
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + oauth2Client.credentials.access_token,
    }
  };

  var readStream = fs.createReadStream(file.path);

  readStream.on('open', function () {
    readStream.pipe(request(options, function (err, res) {
      callback(err, JSON.parse(res.body));
    }));
  });

  readStream.on('error', function (err) {
    throw err;
  });

}

function insertFileAsync(file, oauth2Client, callback) {
  console.log('insering file to google');
  getGoogleUploadUrl(file, oauth2Client, function (err, uploadUrl) {
    if (err) { console.error('google request error: ', err); }
    uploadFileToGoogle(file, uploadUrl, oauth2Client, function (err, result) {
      if (err) { console.error('upload error: ', err); }
      callback(err, result);
    });
  });
}




module.exports = {
  insertFile: insertFile,
  insertFileAsync: insertFileAsync,
  connect: connect
};
