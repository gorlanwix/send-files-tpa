'use strict';

var googleDrive = require('./google-drive.js');
var db = require('./pg-database.js');
var fs = require('fs');
var async = require('async');
var archiver = require('archiver');
var tmp = require('tmp');

var tmpDir = './tmp/';
var archive = archiver('zip');



function zip(files, newName, callback) {

  tmp.tmpName(function (err, path) {
    if (err) {
      console.error('temporary name generation err: ', err);
      return callback(err, null);
    }

    newName += '.zip';
    path += '.zip';

    console.log("Created temporary filename: ", path);
    var output = fs.createWriteStream(tmpDir + path);

    output.on('close', function () {
      console.log(archive.pointer() + ' total bytes');
      var file = {
        name: path,
        mimetype: 'application/zip',
        size: archive.pointer(),
        originalname: newName
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
  });
}


function insertFile(client, file, sessionId, instance, tokens, callback) {
  db.files.updateSessionAndInsert(client, file, sessionId, instance, function (err) {

    if (err) {
      return callback(err, null);
    }

    if (tokens.auth_provider === 'google') {
      googleDrive.insertFile(file, tokens.access_token, function (err, result) {
        if (err) {
          console.error('uploading to google error', err);
          return callback(err, null);
        }
        db.files.setDeleteReady(client, sessionId, function (err) {
          if (err) {
            return callback(err, null);
          }
          callback(null, result);
        });
      });
    }
  });
}
