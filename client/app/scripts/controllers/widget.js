'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;

    /* If true, invalid email messages are shown. */
    $scope.showInvalidEmail = false;

    /* If true, "no message written" message is shown. */
    $scope.missingMessage = false;
    
    /* If true, upload failure messages are shown. */
    $scope.uploadFailed = false;

    /* List of files. Initalized as empty list. */
    $scope.fileList = [];

    /* List of files that are too large for uploading. */
    $scope.tooLargeList = [];

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

    /* Call this when the user selects file(s) to begin file upload.
     * 1GB = 1073741824 bytes
     * 1MB = 1048576 bytes
     */
    $scope.onFileSelect = function($files) {
      for(var i = 0; i < $files.length; i++) {
        var file = $files[i];
        if (file.size > 1073741824) { //Test with files almost 1GB
          file.newSize = (Math.floor(file.size / 1073741824 * 100) / 100).toString() + 'GB';
          $scope.tooLargeList.push(file);
          console.log(file.size);
        } else {
          var sizeInMB = Math.floor(file.size / 1048576);
          if (sizeInMB === 0) {
            file.newSize = '< 1MB';
          } else {
            file.newSize = sizeInMB.toString() + 'MB';
          }
          $scope.fileList.push(file);
        }
      }
    };

    /* Call this when user wants to remove file from list. */
    $scope.removeFile = function(file) { /* TODO: Pass in file in HTML somehow! */
      var index = fileList.indexOf(file);
      if (index > -1) {
        $scope.fileList.splice()
        console.log(fileList); // for verification - remove later
      } else {
        console.log('ERROR - NO FILE FOUND');
      }
    }

    $scope.submit = function() {
      //send fileList to server
    }

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
