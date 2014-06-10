'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix) {
    $scope.emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(\.[a-z0-9-]+){1}$/;

    $scope.showInvalidEmail = false;

    $scope.mouseover = function() {
      console.log('why?');
      if ($scope.fileForm.email.$invalid) {
        $scope.showInvalidEmail = true;
        console.log('but');
      }
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
      $wix.Settings.refreshApp({submitButtonText3: 'hello'});
      console.log($scope.submitButtonText);
      console.log('but');
    };


  });