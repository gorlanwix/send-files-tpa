'use strict';

module.exports = {
  session: require('./sessions-db.js'),
  files: require('./files-db.js'),
  token: require('./tokens-db.js'),
  widget: require('./widget-db.js'),
  failure: require('./failure-db.js')
};


// var handleError = function (client, done, err) {
//     // no error occurred, continue with the request
//     if (!err) { return false; }

//     done(client);
//     console.error('query error: ', err);
//     return true;
// };

