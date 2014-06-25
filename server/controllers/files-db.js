'use strict';

var session = require('./sessions-db.js');
var query = require('../config.js').query;


function createFileIdsValuesSelectQuery(valLength) {

  // laziness and reduce where are you when you are needed???
  var query = '';
  var i;
  for (i = 2; i < valLength + 2; i++) {
    query += '$' + i + ',';
  }

  return query.substring(0, query.length - 1);
}

var insert = module.exports.insert = function (file, sessionId, callback) {
  var q = 'INSERT INTO file (session_id, temp_name, original_name, size, created) \
           VALUES ($1, $2, $3, $4, NOW()) \
           RETURNING file_id';
  var values = [
    sessionId,
    file.name,
    file.originalname,
    file.size
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db file insert error: ', err);
      return callback(err, null);
    }

    callback(null, rows.file_id);
  });
}


module.exports.getByIds = function (sessionId, fileIds, callback) {
  var queryValues = createFileIdsValuesSelectQuery(fileIds.length);

  var q = 'SELECT *, SUM(size) \
           OVER (PARTITION BY session_id) \
           FROM file \
           WHERE file_id IN (' + queryValues + ') \
           AND session_id = $1';

  var values = [sessionId].concat(fileIds);

  query(q, values, function (err, rows, result) {
    if (err) {
      console.error('db file getByIds error: ', err);
      return callback(err, null);
    }

    callback(null, result.rows);
  });
}


module.exports.checkSessionAndInsert = function (file, sessionId, callback) {

  session.isOpen(sessionId, function (err, isOpen) {

    if (err) {
      return callback(err, null);
    }

    if (!isOpen) {
      return callback(new Error('session is closed'), null);
    }

    insert(file, sessionId, function (err, fileId) {

      if (err) {
        return callback(err, null);
      }

      callback(null, fileId);
    });
  });
}