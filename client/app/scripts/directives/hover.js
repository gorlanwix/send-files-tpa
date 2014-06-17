'use strict';

angular.module('sendFiles')
  .directive('hover', function(){
      return function(scope, element) {
        element.bind('mouseenter', function(){
            element.addClass('hover');
          }).bind('mouseleave', function(){
            element.removeClass('hover');
          });
      };
    });