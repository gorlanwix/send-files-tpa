'use strict';

var googleDrive = require('./google-drive.js');
var dropbox = require('./dropbox.js');
var db = require('../models/pg-database.js');
var email = require('./email.js');
var wixActivities = require('./wix-activities.js');
var user = require('../controllers/user.js');


var fs = require('fs');
var async = require('async');
var archiver = require('archiver');

var tmpDir = require('../config.js').TMP_DIR;

/**
 * Creates a tempory name for uploaded file
 * @param  {String} filename original name of the file
 * @return {String} hash
 */
function generateTmpName(filename) {
  var random_string = filename + Date.now() + Math.random();
  return require('crypto')
    .createHash('md5')
    .update(random_string)
    .digest('hex');
}

/**
 * Zips multiple files into one archive
 * @param  {Array}    files    Array of file objects to be zipped
 * @param  {String}   newName  original name of the file
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}   file object describing archive
 */
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

/**
 * Zips multiple files into one archive
 * and records it in file database
 * @param  {Array}    files     Array of file objects to be zipped
 * @param  {Visitor}  Visitor  represent visitor who uploaded the files
 * @param  {number}   sessionId session id of the upload
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}   file object describing archive with fileId set
 */
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


/**
 * Upload file to service user is currently signed in
 * @param  {Object}   file            file to be uploaded
 * @param  {Object}   serviceSettings settings required for the service to upload
 * @param  {Object}   tokens          account tokens for auth
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}                   response of the upload
 */
function serviceInsert(file, serviceSettings, tokens, callback) {

  switch (tokens.provider) {
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
        console.error('uploading to dropbox error', err);
        return callback(err, null);
      }
      console.log('inserted file: ', result);
      callback(null, result);
    });
    return;
  default:
    callback(new Error('invalid provider'), null);
  }
}



/**
 * Handle error based on its type
 * @param  {Error}     error     error to be handled
 * @param  {WixWidget} instance
 * @param  {Object}    file      file that failed
 * @param  {Visitor}   visitor   visitor that failed
 * @param  {Function}  callback
 * @return {Error}
 */
function handleError(error, instance, file, visitor, callback) {
  console.error('zipping and inserting error: ', error);
  switch (error.type) {
  case 'insert':
    if (error.status === 401) {
      user.remove(instance, callback);
    } else {
      console.error('registering upload failure: ', error);
      db.failure.insert(file.fileId, callback);
    }
    break;
  case 'zip':
  case 'settings':
  default:
    console.error('sending error emails, terrible error: ', error);
    email.sendError(visitor, function (err, res) {
      callback(err);
    });
    break;
  }
}

/**
 * Insert file to service and post activity to wix
 * @param  {Object}         file     file to be uploaded
 * @param  {WidgetSettings} settings
 * @param  {Visitor}        visitor
 * @param  {WixWidget}      instance
 * @param  {Object}         tokens
 * @param  {Function}       callback
 * @return {Error}
 */
var serviceInsertAndActivity = module.exports.serviceInsertAndActivity = function (file, settings, visitor, instance, tokens, callback) {
  serviceInsert(file, settings.service_settings, tokens, function (err, viewUrl) {
    if (err) {
      err.type = 'insert';
      handleError(err, instance, file, visitor, callback);
    }
    if (visitor.wixSessionToken === 'diamond') {
      return callback(null);
    }
    wixActivities.post(instance, visitor, viewUrl, callback);
  });
};

/**
 * Public method that zips, uploads and posts activity to wix
 * @param  {Array}     files      files to be zipped and uploaded
 * @param  {Visitor}   visitor
 * @param  {WixWidget} instance
 * @param  {number}    sessionId id of upload
 * @param  {Object}    tokens
 * @param  {Function}  callback
 * @return {Error}     something really bad happened
 */
module.exports.sendFiles = function (files, visitor, instance, sessionId, tokens, callback) {
  db.widget.getSettings(instance, function (err, settings) {
    if (err || !settings) {
      err.type = 'settings';
      handleError(err, instance, null, visitor, callback);
    }

    zipAndRegister(files, visitor, sessionId, function (err, archive) {
      if (err) {
        err.type = 'zip';
        handleError(err, instance, archive, visitor, callback);
      }

      serviceInsertAndActivity(archive, settings, visitor, instance, tokens, callback);
    });
  });
};


/**
 * Get available quota of service user is signed in to
 * @param  {Object}   tokens   of current user
 * @param  {Function} callback
 * @return {Error}
 * @return {number}   free quota
 */
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
