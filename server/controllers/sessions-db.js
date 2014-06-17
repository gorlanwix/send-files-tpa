'use strict';

function open(client, instance, callback) {
  var query = 'INSERT INTO session (instance_id, component_id, last_access, created) \
               VALUES ($1, $2, NOW(), NOW()) \
               RETURNING session_id';
  var values = [
    instance.instanceId,
    instance.compId
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('session insert error: ', err);
      return callback(err, null);
    }

    callback(null, result.rows[0].session_id);
  });
}

// prolongs session by updating lastest access to current time
function update(client, sessionId, instance, callback) {
  var query = 'UPDATE session \
               SET last_access = NOW() \
               WHERE session_id = $1 \
               AND component_id = $2 \
               AND instance_id = $3';
  var values = [
    sessionId,
    instance.instanceId,
    instance.compId
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('session update error: ', err);
      callback(err);
      return;
    }

    callback(null);
  });
}

function destroy(client, sessionId, instance, callback) {
  var query = 'DELETE FROM session \
               WHERE session_id = $1 \
               AND component_id = $2 \
               AND instance_id = $3';
  var values = [
    sessionId,
    instance.instanceId,
    instance.compId
  ];

  client.query(query, values, function (err, result) {
    if (err) {
      console.error('session delete error: ', err);
      return callback(err);
    }

    callback(null);
  });
}


module.exports = {
  open: open,
  update: update,
  destroy: destroy
};
