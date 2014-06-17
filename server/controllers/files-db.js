'use strict';

var session = require('./sessions-db.js');


function createFileIdsValuesSelectQuery(valLength) {

  // laziness and reduce where are you when you are needed???
  var query = '';
  var i;
  for (i = 2; i < valLength + 2; i++) {
    query += '$' + i + ',';
  }

  return query.substring(0, query.length - 1);
}

function insert(client, sessionId, file, callback) {
  var query = 'INSERT INTO file (session_id, temp_name, original_name, size, created) \
               VALUES ($1, $2, $3, $4, NOW()) \
               RETURNING file_id';
  var values = [
    sessionId,
    file.name,
    file.originalname,
    file.size
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('file insert error: ', err);
      callback(err, null);
      return;
    }

    callback(null, result.rows[0].file_id);
  });
}


function getByIds(client, sessionId, fileIds, callback) {
  var queryValues = createFileIdsValuesSelectQuery(fileIds.length);

  var query = 'SELECT *, SUM(size) \
               OVER (PARTITION BY session_id) \
               FROM file \
               WHERE file_id IN (' + queryValues + ') \
               AND session_id = $1';

  var values = [sessionId].concat(fileIds);

  client.query(query, values, function (err, result) {
    if (err) {
      return callback(err, null);
    }

    callback(null, result.rows);
  });
}


function updateSessionAndInsert(client, file, sessionId, instance, callback) {

  session.update(client, sessionId, instance, function (err) {

    if (err) {
      // expired session or non-existing session or mistyped sessionId
      callback(err, null);
      return;
    }

    insert(client, sessionId, file, function (err, fileId) {

      if (err) {
        callback(err, null);
        return;
      }

      callback(null, fileId);

    });
  });
}

module.exports = {
  insert: insert,
  getByIds: getByIds,
  updateSessionAndInsert: updateSessionAndInsert
};