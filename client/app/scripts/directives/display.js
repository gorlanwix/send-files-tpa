'use strict';

angular.module('sendFiles')
  .directive('display', function(){
      return function(scope, element) {
        element.bind('click', function(){
            element.parent().addClass('display');
          });
      };
    });