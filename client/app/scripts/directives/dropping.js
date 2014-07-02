'use strict';

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
            element[0].addEventListener('dragleave', function(evt) {
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