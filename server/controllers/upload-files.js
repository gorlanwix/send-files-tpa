'use strict';

var googleDrive = require('./google-drive.js');
var dropbox = require('./dropbox.js');
var db = require('./pg-database.js');
var email = require('./email.js');
var wixActivities = require('./wix-activities.js');


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
  var date = [now.getMonth() + 1, now.getDate(), now.getFullYear()];
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

  switch(tokens.provider) {
    case 'google':
      googleDrive.insertFile(file, serviceSettings.folderId, tokens.access_token, function (err, result) {
        if (err) {
          console.error('uploading to google error', err);
          return callback(err, null);
        }
        console.log('inserted file: ', result);
        callback(null, result.alternateLink);
      });
      return;
    case 'dropbox':
      dropbox.insertFile(file, tokens.access_token, function (err, result) {
        if (err) {
          console.error('uploading to google error', err);
          return callback(err, null);
        }
        console.log('inserted file: ', result);
        callback(null, result.alternateLink);
      });
      return;
    default:
      callback(new Error('invalid provider'), null);
  }
}




function handleError(error, file, settings, visitor, callback) {
  console.error('zipping and inserting error: ', error);
  switch (error.type) {
  case 'insert':
    if (error.status !== 401) {
      console.error('registering upload failure: ', error);
      db.failure.insert(file.fileId, callback);
    }
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


var serviceInsertAndEmail = module.exports.serviceInsertAndEmail = function (file, settings, visitor, instance, tokens, callback) {
  serviceInsert(file, settings.service_settings, tokens, function (err, viewUrl) {
    if (err) {
      err.type = 'insert';
      handleError(err, file, settings, visitor, callback);
    }

    wixActivities.post(instance, visitor, viewUrl, callback);
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

      serviceInsertAndEmail(archive, settings, visitor, instance, tokens, callback);
    });
  });
};



module.exports.getAvailableCapacity = function (tokens, callback) {
  switch (tokens.provider) {
  case 'google':
    googleDrive.getAvailableCapacity(tokens.access_token, callback);
    break;
  case 'dropbox':
    dropbox.getAvailableCapacity(tokens.access_token, callback);
    break;
  default:
    callback(new Error('invalid provider'), null);
    break;
  }
};
