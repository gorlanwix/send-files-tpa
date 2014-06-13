'use strict';


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
      return callback(err, null);
    }

    callback(null, result.rows[0].file_id);
  });
}


function getByIds(client, sessionId, fileIds, callback) {
  var queryValues = createFileIdsValuesSelectQuery(fileIds.length);

  var query = 'SELECT *, SUM(size) AS total_size \
               OVER (PARTITION BY session_id) \
               FROM file \
               WHERE file_id IN (' + queryValues + ') \
               AND session_id = $1';

  var values = [sessionId].concat(fileIds);

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('file setUploadReady error: ', err);
      return callback(err, null);
    }

    callback(null, result.rows);
  });
}

// once done with upload, set all files from the session ready to delete
function setDeleteReady(client, sessionId, callback) {

  var query = 'UPDATE file \
               SET delete_ready = true \
               WHERE session_id = $1';

  var values = [sessionId];

  client.query(query, values, function (err) {
    if (err) {
      console.error('file setDeleteReady error: ', err);
      return callback(err);
    }

    callback(null);
  });
}

module.exports = {
  insert: insert,
  getByIds: getByIds,
  setDeleteReady: setDeleteReady
};