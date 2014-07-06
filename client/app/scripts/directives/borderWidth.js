'use strict';
/**
 * This directive binds an event listener to all the relevant elements whose
 * border width can be adjusted by the user. This means all changes in the
 * settings will immediately be reflected in the widget.
 */
angular.module('sendFiles')
  .directive('borderWidth', function() {
        return {
          link: function(scope, element) {
            scope.$watch(function() {
                return scope.settings.borderWidth;
              },
              function() {
                element.children().css('border-width', scope.settings.borderWidth + 'px');
              });
          }
        };
      });