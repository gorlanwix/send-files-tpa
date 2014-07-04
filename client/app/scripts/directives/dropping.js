'use strict';
/**
 * This directive adds event listeners to make the "drop files here" element
 * appear when the user drags a file anywhere over the widget. The element
 * disappears once the files are dropped or dragged out of the widget.
 */
angular.module('sendFiles')
  .directive('dropping', function() {
        return {
          link: function(scope, element) {
            element[0].addEventListener('dragover', function(evt) {
              scope.dropping = true;
              evt.stopPropagation();
              evt.preventDefault();
              scope.dropping = true;
            }, true);
            element[0].addEventListener('dragleave', function() {
              scope.dropping = false;
            }, false);
            element[0].addEventListener('drop', function(evt) {
              evt.stopPropagation();
              evt.preventDefault();
              scope.dropping = false;
            }, false);
          }
        };
      });