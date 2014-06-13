'use strict';

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
      return callback(err, undefined);
    }

    callback(err, result.rows[0].file_id);
  });
}

function createFileIdsValuesQuery(valLength) {

  // laziness and reduce where are you when you are needed???
  var query = 'VALUES ';
  var i;
  for (i = 2; i < valLength + 2; i++) {
    query += '($' + i + '),';
  }

  return query.substring(0, query.length - 1);
}


function setUploadReady(client, sessionId, fileIds, callback) {
  var queryValues = createFileIdsValuesQuery(fileIds.length);

  var query = 'UPDATE file \
               SET upload_ready = true \
               FROM (' + queryValues + ') \
               AS ready(id) \
               WHERE file_id = ready.id \
               AND sessionId = $1 \
               RETURNING *';

  var values = [sessionId].concat(fileIds);

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('file setUploadReady error: ', err);
      return callback(err, undefined);
    }

    callback(err, result.rows);
  });
}


function setDeleteReady(client, sessionId, callback) {

  var query = 'UPDATE file \
               SET delete_ready = true \
               WHERE sessionId = $1';

  var values = [sessionId];

  client.query(query, values, function (err, result) {
    if (err) { console.error('file setDeleteReady error: ', err); }

    callback(err, result);
  });
}

module.exports = {
  insert: insert,
  setUploadReady: setUploadReady,
  setDeleteReady: setDeleteReady
};