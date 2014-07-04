'use strict';
/**
 * This directive adds event listeners that make the box of the uploaded file
 * the user is hovering over turn a light yellow to indicate selection.
 */
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