'use strict';

var config = require('../config.js');
var query = config.query;
var EXPIRE_TIME = config.EXPIRE_TIME;

module.exports.insert = function (fileId, callback) {
  var q = 'INSERT INTO upload_failure (file_id) \
           VALUES ($1)';
  var values = [
    fileId
  ];

  query(q, values, function(err) {
    if (err) {
      console.error('inserting failure error: ', err);
    }
    callback(err);
  });
}


module.exports.resolve = function (fileId, callback) {
  var q = 'UPDATE upload_failure \
           SET resolved = $2 \
           VALUES ($1)';
  var values = [
    fileId,
    true
  ];

  query(q, values, callback);
}


module.exports.getAll = function (callback) {
  var q = 'SELECT s.instance_id, s.component_id, file.file_id, file.temp_name, file.original_name, file.size, w.curr_provider, w.service_settings, w.user_email \
           FROM session AS s, file, widget_settings AS w, upload_failure AS fail \
           WHERE fail.resolved = $1 \
           AND file.file_id = fail.file_id \
           AND file.created > $2 \
           AND s.session_id = file.session_id \
           AND w.instance_id = s.instance_id \
           AND w.component_id = s.component_id';
  var values = [
    false,
    new Date(new Date().getTime() - EXPIRE_TIME)
  ];

  query(q, values, callback);
}