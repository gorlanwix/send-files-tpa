'use strict';

module.exports = {
  session: require('./sessions-db.js'),
  files: require('./files-db.js'),
  token: require('./tokens-db.js'),
  widget: require('./widget-db.js'),
  failure: require('./failure-db.js')
};

