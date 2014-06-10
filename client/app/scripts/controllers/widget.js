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

    //Pseudocode for getting settings to appear
    $scope.headlineText = 'Upload the file and send it to us. We will review it as soon as possible.';
    $scope.addButtonText = '+ Add Files';
    $scope.noFileText = '';
    $scope.emailAddressText = 'Your email address';
    $scope.messageText = 'You can add a message to site owner';
    $scope.submitButtonText = 'Submit';

    $scope.email = 'hello';
    //$scope.cool = false;
    $scope.setSettings = function() {
      console.log('hi');
      $wix.Settings.refreshApp();
      console.log($scope.submitButtonText);
      console.log('but');
    };


  });