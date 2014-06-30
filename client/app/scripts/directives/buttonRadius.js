'use strict';

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