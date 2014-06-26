'use strict';

var googleDrive = require('./google-drive.js');
var db = require('./pg-database.js');
var email = require('./email.js');

var fs = require('fs');
var async = require('async');
var archiver = require('archiver');

var tmpDir = require('../config.js').TMP_DIR;


function generateTmpName(filename) {
  var random_string = filename + Date.now() + Math.random();
  return require('crypto')
    .createHash('md5')
    .update(random_string)
    .digest('hex');
}


function zip(files, newName, callback) {
  var archive = archiver('zip');

  var tmpName = generateTmpName(newName);

  newName += '.zip';
  tmpName += '.zip';
  var tmpPath = tmpDir + tmpName;
  var output = fs.createWriteStream(tmpPath);

  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    var file = {
      name: tmpName,
      mimetype: 'application/zip',
      size: archive.pointer(),
      originalname: newName,
      path: tmpPath
    };
    callback(null, file);
  });

  output.on('error', function (err) {
    console.error('saving archive error: ', err);
    return callback(err, null);
  });

  archive.pipe(output);

  archive.on('error', function (err) {
    console.error('archiving error: ', err);
    return callback(err, null);
  });

  async.each(files, function (file, callback) {
    archive.append(fs.createReadStream(tmpDir + file.temp_name), {name: file.original_name});
    callback(null);
  }, function (err) {
    if (err) {
      console.error('async error: ', err);
      return callback(err, null);
    }

    archive.finalize();
  });
}


function zipAndRegister(files, visitor, sessionId, callback) {
  var now = new Date();
  var date = [now.getMonth(), now.getDay(), now.getYear()];
  var zipName = visitor.name + ' ' + date.join('-');
  zip(files, zipName, function (err, archive) {
    if (err) {
      return callback(err, null);
    }
    console.log('zipped file: ', archive);
    db.files.insert(archive, sessionId, function (err, fileId) {
      if (err) {
        console.error('db inserting zip to database error', err);
        return callback(err, null);
      }

      archive.fileId = fileId;

      callback(null, archive);
    });
  });
}


// uploads file to file service, returns url to view
function serviceInsert(file, serviceSettings, tokens, callback) {

  if (tokens.provider === 'google') {
    googleDrive.insertFile(file, serviceSettings.folderId, tokens.access_token, function (err, result) {
      if (err) {
        console.error('uploading to google error', err);
        return callback(err, null);
      }
      console.log('inserted file: ', result);
      callback(null, result.alternateLink);
    });
  }
}




function handleError(error, file, settings, visitor, callback) {
  console.error('zipping and inserting error: ', error);
  switch (error.type) {
  case 'insert':
    console.error('registering upload failure: ', error);
    db.failure.insert(file.fileId, callback);
    break;
  case 'zip':
  case 'settings':
  default:
    console.error('sending error emails, terrible error: ', error);
    email.sendErrors(settings.user_email, visitor, function (err, res) {
      callback(err);
    });
    break;
  }
}


var serviceInsertAndEmail = module.exports.serviceInsertAndEmail = function (file, settings, visitor, tokens, callback) {
  serviceInsert(file, settings.service_settings, tokens, function (err, downloadUrl) {
    if (err) {
      err.type = 'insert';
      handleError(err, file, settings, visitor, callback);
    }

    email.send(settings.user_email, visitor, downloadUrl, function (err) {
      if (err) {
        console.error('sending emails error', err);
      }
      callback(err);
    });
  });
};


module.exports.sendFiles = function (files, visitor, instance, sessionId, tokens, callback) {
  db.widget.getSettings(instance, function (err, settings) {
    if (err) {
      err.type = 'settings';
      handleError(err, null, settings, visitor, callback);
    }
    zipAndRegister(files, visitor, sessionId, function (err, archive) {
      if (err) {
        err.type = 'zip';
        handleError(err, file, settings, visitor, callback);
      }

      serviceInsertAndEmail(archive, settings, visitor, tokens, callback);
    });
  });
};



module.exports.getAvailableCapacity = function (tokens, callback) {
  if (tokens.provider === 'google') {
    googleDrive.getAvailableCapacity(tokens.access_token, function (err, capacity) {
      if (err) {
        return callback(err, null);
      }
      callback(null, capacity);
    });
  }
};
