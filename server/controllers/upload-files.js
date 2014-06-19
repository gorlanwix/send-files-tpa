'use strict';

var googleDrive = require('./google-drive.js');
var db = require('./pg-database.js');
var fs = require('fs');
var async = require('async');
var archiver = require('archiver');
var crypto = require('crypto');
var archive = archiver('zip');

var tmpDir = './tmp/';


function generateTempName(filename) {
  var random_string = filename + Date.now() + Math.random();
  return crypto.createHash('md5').update(random_string).digest('hex');
}


function zip(files, newName, callback) {

  var tempName = generateTempName(newName);

  newName += '.zip';
  tempName += '.zip';
  var tempFolder = tmpDir + tempName;
  console.log("Created temporary filename: ", tempName);
  var output = fs.createWriteStream(tempFolder);

  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    var file = {
      name: tempName,
      mimetype: 'application/zip',
      size: archive.pointer(),
      originalname: newName,
      path: tempFolder
    };
    callback(null, file);
  });

  output.on('error', function (err) {
    console.error('saving archive error: ', err);
    callback(err, null);
  });

  archive.pipe(output);

  archive.on('error', function (err) {
    console.error('archiving error: ', err);
    callback(err, null);
  });

  async.each(files, function (file, callback) {
    if (file !== '.' || file !== '..') {
      archive.append(fs.createReadStream(tmpDir + file.temp_name), {name: file.original_name});
    }
    callback();
  }, function (err) {
    if (err) {
      console.error('async error: ', err);
      return callback(new Error('async execution failed'), null);
    }

    archive.finalize();
  });
}


function insertFile(file, sessionId, instance, tokens, callback) {
  db.files.updateSessionAndInsert(file, sessionId, instance, function (err) {
    console.log('inserted into database: ', file);
    if (err) {
      return callback(err, null);
    }

    if (tokens.provider === 'google') {
      googleDrive.insertFile(file, tokens.access_token, function (err, result) {
        if (err) {
          console.error('uploading to google error', err);
          return callback(err, null);
        }
        callback(null, result);
      });
    }
  });
}


function getAvailableCapacity(tokens, callback) {
  if (tokens.provider === 'google') {
    googleDrive.getAvailableCapacity(tokens.access_token, function (err, capacity) {
      if (err) {
        return callback(err, null);
      }
      callback(null, capacity);
    });
  }
}

module.exports = {
  zip: zip,
  insertFile: insertFile,
  getAvailableCapacity: getAvailableCapacity
};
