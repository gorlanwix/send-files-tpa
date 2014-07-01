'use strict';

var config = require('../config.js');
var query = config.query;
var EXPIRE_TIME = config.EXPIRE_TIME;


/**
 * Insert a file upload failure
 * @param  {number}   fileId   id of file that failed to upload
 * @param  {Function} callback
 * @return {Error}
 */
module.exports.insert = function (fileId, callback) {
  var q = 'INSERT INTO upload_failure (file_id) \
           VALUES ($1)';
  var values = [
    fileId
  ];

  query(q, values, function (err) {
    if (err) {
      console.error('inserting failure error: ', err);
    }
    callback(err);
  });
};

/**
 * Mark failure as resolved
 * @param  {number}   fileId   id of the file that was successfully uploaded
 * @param  {Function} callback
 * @return {Error}
 */
module.exports.resolve = function (fileId, callback) {
  var q = 'UPDATE upload_failure \
           SET resolved = $2 \
           VALUES ($1)';
  var values = [
    fileId,
    true
  ];

  query(q, values, callback);
};

/**
 * Get all outstanding failures for last 24 hours
 * @param  {Function} callback
 * @return {Error}
 * @return {Array} array of object with following fields:
 *
 * instance_id
 * component_id
 * file_id
 * temp_name
 * original_name
 * size
 * curr_provider
 * service_settings
 */
module.exports.getAll = function (callback) {
  var q = 'SELECT s.instance_id, s.component_id, file.file_id, file.temp_name, file.original_name, file.size, w.curr_provider, w.service_settings \
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
};