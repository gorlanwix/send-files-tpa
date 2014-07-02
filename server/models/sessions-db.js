'use strict';

var query = require('../config.js').query;

/**
 * Opens new upload session
 * @param  {WixWidget} instance
 * @param  {Function}  callback
 * @return {Error}
 * @return {number}    session id
 */
module.exports.open = function (instance, callback) {
  var q = 'INSERT INTO session (instance_id, component_id, created) \
           VALUES ($1, $2, NOW()) \
           RETURNING session_id';
  var values = [
    instance.instanceId,
    instance.compId
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db session insert error: ', err);
      return callback(err, null);
    }

    callback(null, rows.session_id);
  });
}

/**
 * Checks if session is open
 * @param  {number}    sessionId id of upload session
 * @param  {WixWidget} instance  for checking rights
 * @param  {Function}  callback
 * @return {Error}
 * @return {Boolean}            true if open, fase if cloased
 */
module.exports.isOpen = function (sessionId, instance, callback) {
  var q = 'SELECT closed \
           FROM session \
           WHERE session_id = $1 \
           AND instance_id = $2 \
           AND component_id = $3';
  var values = [
    sessionId,
    instance.instanceId,
    instance.compId
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('db session isOpen error: ', err);
      return callback(err, null);
    }

    callback(null, !rows.closed);
  });
}

/**
 * Closes upload session
 * @param  {number}   sessionId upload session id to close
 * @param  {WixWidget} instance  for checking rights
 * @param  {Function} callback
 * @return {Error}
 * @return {Object}   session row that was closed
 */
module.exports.close = function (sessionId, instance, callback) {
  var q = 'UPDATE session \
           SET closed = $1 \
           WHERE session_id = $2 \
           AND instance_id = $3 \
           AND component_id = $4 \
           AND closed = $5 \
           RETURNING *';
  var values = [
    true,
    sessionId,
    instance.instanceId,
    instance.compId,
    false
  ];

  query.first(q, values, function (err, row, result) {
    if (err) {
      console.error('db session close error: ', err);
      return callback(err, null);
    }

    callback(null, row);
  });
}
