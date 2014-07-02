'use strict';

angular.module('sendFiles')
  .directive('widgetCorners', function() {
        return {
          link: function(scope, element) {
            scope.$watch(function() {
                return scope.settings.widgetCorners;
              },
              function() {
                if (element.hasClass('top-block')) {
                  element.css('border-top-left-radius', scope.settings.widgetCorners + 'px');
                  element.css('border-top-right-radius', scope.settings.widgetCorners + 'px');
                } else if (element.hasClass('bottom-block')) {
                  element.css('border-bottom-left-radius', scope.settings.widgetCorners + 'px');
                  element.css('border-bottom-right-radius', scope.settings.widgetCorners + 'px');
                } else {
                  element.children().css('border-radius', scope.settings.widgetCorners + 'px');
                }
              });
          }
        };
      });