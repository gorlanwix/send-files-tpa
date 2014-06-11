'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;

    /* If true, invalid email messages are shown. */
    $scope.showInvalidEmail = false;

    /* If true, "no message written" message is shown. */
    $scope.missingMessage = false;
    
    /* If true, upload failure messages are shown. */
    $scope.uploadFailed = false;

        /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function() {
      if ($scope.fileForm.email.$invalid) {
        $scope.showInvalidEmail = true;
      }
      if ($scope.fileForm.message.$invalid) {
        $scope.showNoMessage = true;
      }
    };

    /* Call this to get error messages to disappear. */
    $scope.disableErrorMessage = function() {
      $scope.showInvalidEmail = false;
      $scope.showNoMessage = false;
    };

    /* Call this function after the user has changed their settings
     * to initiate changes in the widget. */
    $scope.setSettings = function() {
      console.log('hi');
      $wix.Settings.refreshApp();
      console.log($scope.submitButtonText);
      console.log('but');
    };

    /* Call this when the user clicks submit to begin file upload. */
    $scope.startUpload = function() {
      // do files need to do be an argument to this function?

      //upload the files 
      //call backend 
    };

    /* Call this function when the file has failed to upload. Changes
     * widget to show error messages to the site visitor and gives
     * opportunity to try to upload again. */
    $scope.initiateFailure = function() {
      $scope.uploadFailed = true;
    };

    /* Call this to reset widget after widget upload fail.
     * All upload failure messages will disappear. */
    $scope.reset = function() {
      $scope.uploadFailed = false;
    };

    /* Call this to show success widget after widget upload.
     * A "Add more files" Button will appear to allow the user
     * to upload more files. */
    $scope.success = function() {
      $scope.headlineText = 'Success! Your files were sent.';
      $scope.success = true;
    };

    $scope.settings = api.getSettings(true);
  });
