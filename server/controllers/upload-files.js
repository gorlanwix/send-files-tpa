'use strict';

var googleDrive = require('./google-drive.js');
var db = require('./pg-database.js');
var fs = require('fs');
var async = require('async');
var archiver = require('archiver');
var crypto = require('crypto');
var archive = archiver('zip');

var tmpDir = require('../config.js').TMP_DIR;


function generateTmpName(filename) {
  var random_string = filename + Date.now() + Math.random();
  return crypto.createHash('md5').update(random_string).digest('hex');
}


function zip(files, newName, callback) {

  var tmpName = generateTmpName(newName);

  newName += '.zip';
  tmpName += '.zip';
  var tempFolder = tmpDir + tmpName;
  console.log("Created temporary filename: ", tmpName);
  var output = fs.createWriteStream(tempFolder);

  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    var file = {
      name: tmpName,
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

// returns link to file
function insertFile(file, serviceSettings, sessionId, tokens, callback) {
  db.files.updateSessionAndInsert(file, sessionId, function (err) {
    console.log('inserted into database: ', file);
    if (err) {
      return callback(err, null);
    }

    if (tokens.provider === 'google') {
      googleDrive.insertFile(file, serviceSettings.folderId, tokens.access_token, function (err, result) {
        if (err) {
          console.error('uploading to google error', err);
          return callback(err, null);
        }
        result = JSON.parse(result);
        console.log('inserted file: ', result);
        callback(null, result.alternateLink);
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

// returns downloadUrl and widget settings object

function zipAndInsert(files, visitor, instance, sessionId, tokens, callback) {
  db.widget.getSettings(instance, function (err, settings) {
    if (!settings) {
      return callback(err, null, null);
    }
    var zipName = visitor.name.replace(/\s+/g, '-');
    zip(files, zipName, function (err, archive) {
      if (err) {
        return callback(err, null, settings);
      }
      console.log('zipped file: ', archive);
      insertFile(archive, settings.service_settings, sessionId, tokens, function (err, downloadUrl) {

        if (err) {
          console.error('inserting file error: ', err);
          return callback(err, null, settings);
        }

        callback(null, downloadUrl, settings);
      });
    });
  });
}

module.exports = {
  zip: zip,
  insertFile: insertFile,
  zipAndInsert: zipAndInsert,
  getAvailableCapacity: getAvailableCapacity
};
