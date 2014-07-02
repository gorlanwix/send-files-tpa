'use strict';

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