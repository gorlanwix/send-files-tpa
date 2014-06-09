'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api) {
    $scope.emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(\.[a-z0-9-]+){1}$/;

    $scope.showInvalidEmail = function() {
      if (emailInvalid) {
        return true;
      } else {
        return false;
      }
    };







  });