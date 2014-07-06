'use strict';

angular.module('sendFiles').factory('internals', function () {
  /**
   * These are constants used for the widget.
   * @type {Object}
   */
  var constants = {
    GB_BYTES: 1073741824,
    MB_BYTES: 1048576,
    EMAIL_REGEX: /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/
  };

  /**
   * These are the limits placed on visitor uploads.
   * @type {Object}
   */
  var limits = {
    uploadLimit: constants.GB_BYTES,
    maxFileLimit: 60
  };

  /**
   * Used to prevent malicious user input
   * @param  {String} string User input string
   * @return {String} string String representing user input with HTML
   *                         entities escaped
   */
  var escapeHtml = function(string) {
    return string
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;')
         .replace(/\//g, '&#x2F;');
  };

  /**
   * True if debugging and developing on widget.
   * Change to false for production code.
   * @type {Boolean}
   */
  var debug = false;

  return {
    constants: constants,
    limits: limits,
    escapeHtml: escapeHtml,
    debug: debug
  };
});