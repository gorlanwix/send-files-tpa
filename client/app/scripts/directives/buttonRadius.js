'use strict';
/**
 * This directive binds an event listener to all the buttons in the widget.
 * This means all changes in the settings regarding button corners
 * will immediately be reflected in the widget.
 */
angular.module('sendFiles')
  .directive('buttonRadius', function() {
        return {
          link: function(scope, element) {
            scope.$watch(function() {
                return scope.settings.buttonCorners;
              },
              function() {
                element.find('button').css('border-radius', scope.settings.buttonCorners + 'px');
              });
          }
        };
      });