'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix) {
    $scope.emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(\.[a-z0-9-]+){1}$/;

    $scope.showInvalidEmail = false;

    $scope.enableMessage = function() {
      if ($scope.fileForm.$invalid) {
        $scope.showInvalidEmail = true;
      }
    };

    $scope.disableMessage = function() {
      $scope.showInvalidEmail = false;
    };

    $scope.email = 'hello';
    //$scope.cool = false;
    $scope.setSettings = function() {
      console.log('hi');
      $wix.Settings.refreshApp();
      console.log($scope.submitButtonText);
      console.log('but');
    };

    $scope.settings = api.getSettings(true);
  });
