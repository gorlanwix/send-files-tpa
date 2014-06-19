'use strict';

var query = require('../config.js').query;

function open(instance, callback) {
  var q = 'INSERT INTO session (instance_id, component_id, last_access, created) \
           VALUES ($1, $2, NOW(), NOW()) \
           RETURNING session_id';
  var values = [
    instance.instanceId,
    instance.compId
  ];

  query.first(q, values, function (err, rows, result) {
    if (err) {
      console.error('session insert error: ', err);
      return callback(err, null);
    }

    callback(null, rows.session_id);
  });
}

// prolongs session by updating lastest access to current time
function update(sessionId, callback) {
  var q = 'UPDATE session \
           SET last_access = NOW() \
           WHERE session_id = $1';
  var values = [
    sessionId,
  ];

  query(q, values, callback);
}

function destroy(sessionId, callback) {
  var q = 'DELETE FROM session \
           WHERE session_id = $1 \
           AND component_id = $2 \
           AND instance_id = $3';
  var values = [
    sessionId,
    instance.instanceId,
    instance.compId
  ];

  query(q, values, callback);
}


module.exports = {
  open: open,
  update: update,
  destroy: destroy
};
