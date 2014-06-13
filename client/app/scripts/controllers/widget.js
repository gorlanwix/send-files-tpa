'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;

    /* Constants used for byte conversion. */
    var GBbytes = 1073741824;
    var MBbytes = 1048576;

    /* If true, invalid email messages are shown. */
    $scope.showInvalidEmail = false;

    /* If true, "no message written" message is shown. */
    $scope.showNoMessage = false;

    /* If true, "no file chosen" message is shown. */
    $scope.showNoFile = false;

    /* If true, files have been uploaded. */
    var filesChosen = false;

    /* If true, upload failure messages are shown. */
    $scope.uploadFailed = false;

    /* Total size of all uploaded files so far in Bytes. */
    var totalBytes = 0;

    /* Total space left for user to upload files in GB. */
    $scope.totalGBLeft = (GBbytes - totalBytes) / GBbytes;

    /* Used to keep track of the number of files uploaded and their
     * place in various arrays. */
    var fileIndex = 0;

    /* List of files. Initalized as empty list. */
    $scope.fileList = [];

    /* List of files that are too large for uploading. */
    $scope.tooLargeList = [];

    /* A list of files that have gone through the upload process.
     * This list is used for keeping track of files. Used for when
     * the user chooses to remove a file from the list. */
    $scope.upload = [];

     /* A list of numbers representing the progress of each file's
      * upload process. */
    $scope.progress = [];

    /* A list used to tell what files have been successfully uploaded. It is 
     * sent to the backend for verification when the user hits submit. The
     * objects in the array are carrying a fileID given by the backend when
     * the upload has been completed successfully.
     */
    $scope.uploadedFiles = [];

        /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function() {
      if ($scope.fileForm.email.$invalid) {
        $scope.showInvalidEmail = true;
      }
      if ($scope.fileForm.message.$invalid) {
        $scope.showNoMessage = true;
      }
      if (!(filesChosen)) {
        $scope.marginStyle = {'margin-bottom': 0};
        $scope.showNoFile = true;
      }
    };

    /* Call this to get error messages to disappear. */
    $scope.disableErrorMessage = function() {
      $scope.showInvalidEmail = false;
      $scope.showNoMessage = false;
      $scope.marginStyle = {};
      $scope.showNoFile = false;
    };

    /* Call this function after the user has changed their settings
     * to initiate changes in the widget. */
    $scope.setSettings = function() {
      console.log('I am running');
      $wix.Settings.refreshApp();
      console.log($scope.submitButtonText);
    };

    /* Call this when the user selects file(s) to begin file upload.
     * Use this if users can upload unlimited files as long as they don't
     * exceed 1GB.
     */
    $scope.onFileSelectUnlimited = function($files) {
      filesChosen = true;
      // add some total bytes display
      var instanceID = $wix.Utils.getInstanceId();
      for(var i = 0; i < $files.length; i++) {
        var file = $files[i];
        if (file.size > GBbytes) { //Test with files almost 1GB
          file.newSize = (Math.floor(file.size / GBbytes * 100) / 100).toString() + 'GB';
          $scope.tooLargeList.push(file);
          console.log(file.size);
        } else {
          var sizeInMB = Math.floor(file.size / MBbytes);
          if (sizeInMB === 0) {
            file.newSize = ' <1 MB';
          } else {
            file.newSize = sizeInMB.toString() + ' MB';
          }
          $scope.fileList.push(file);
          $scope.start(fileIndex, instanceID);
          console.log(fileIndex); //error checking purposes
          fileIndex += 1;
          console.log(fileIndex); //for error checking;
        } // use this symbol with a button for aborting - &otimes;
      }
    };

    /* Call this  when users select file(s) to begin file upload.
     * Use this when we only want users to upload up to 1GB of files total.
     */
    $scope.onFileSelect = function($files) {
      filesChosen = true;
      var instanceID = $wix.Utils.getInstanceId();
      for (var i = 0; i < $files.length; i++) {
        var file = $files[i];
        if (totalBytes + file.size > GBbytes) {
          file.newSize = (Math.floor(file.size / GBbytes * 100) / 100).toString() + 'GB';
          $scope.tooLargeList.push(file);
        } else {

          var sizeInMB = Math.floor(file.size / MBbytes);
          if (sizeInMB === 0) {
            file.newSize = '< 1MB';
          } else {
            file.newSize = sizeInMB.toString() + 'MB';
          }
          $scope.fileList.push(file);
          totalBytes += file.size;
          
          $scope.totalGBLeft = (GBbytes - totalBytes) / GBbytes;
          $scope.totalGBLeft -= $scope.totalGBLeft%0.01;
          
          $scope.start(fileIndex, instanceID);
          fileIndex += 1;
        }
        console.log(fileIndex); //for error checking;
      }
    };

    $scope.start = function(index, instanceID) {
      $scope.progress[index] = 0;

      console.log(index);
      $scope.upload[index] = $upload.upload({
        url: '/api/files/upload?sessionId=', //finish this!
        method: 'POST',
        headers: {'x-wix-instance' : instanceID},
        file: $scope.fileList[index], //could technically upload all files - but only supported in HTML 5
      }).progress(function(evt) {
        console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total, 10));
        $scope.progress[index] = Math.min(95, parseInt(95.0 * evt.loaded / evt.total, 10));
        //fill in other 100 when sucess
        /* Use this data to implment progress bar */
      }).success(function(data, status, headers, config) {
          //assuming data is the temp ID
          console.log(data);
          if (status === 201) {
            var uploadVerified = {'fileId' : data};
            $scope.uploadedFiles.push(uploadVerified);
            $scope.progress[index] = 100;
          } else {
            console.log('ERROR ERROR ERROR: success failed!');
          }
      }).error(function(data, status, headers, config) {
          console.log('ERROR ERROR ERROR');
          console.log(data);
          //give try again error to user
      }).xhr(function(xhr) {
          xhr.upload.addEventListener('abort', function() {
            console.log('abort complete');
          }, false); //check if this is necessary
      });
    };

    /* Call this when user wants to remove file from list. */
    $scope.abort = function(index) { /* TODO: Pass in file in HTML somehow! */
      $scope.upload[index].abort();
      $scope.upload[index] = null;
      $scope.uploadedList[index] = null;
    };
    /* Call this when user submits form with files, email, and message */
    $scope.submit = function() {
      //rebuild uploadedList, get rid of null values
      //send $scope.uploadedList to server

      //wait for status 202
    };

    /* Call this function when the file has failed to upload. Changes
     * widget to show error messages to the site visitor and gives
     * opportunity to try to upload again. */
    $scope.initiateFailure = function() {
      //call this only if submit fails
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
