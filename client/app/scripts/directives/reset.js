'use strict';

angular.module('sendFiles')
  .directive('reset', function(){
      return function(scope, element) {
        element.bind('click', function(){
            console.log('start');
            console.log(element.parent().parent().children()[2]);
            console.log('end');
          });
      };
    });