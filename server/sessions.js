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
    if (err) { console.error('session insert error: ', err); }

    callback(err, result.rows[0].session_id);
  });
}


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
      return callback(err, undefined);
    }

    callback(err, result);
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
      return callback(err, result);
    }

    callback(err, result);
  });
}


module.exports = {
  open: open,
  update: update,
  destroy: destroy
};
