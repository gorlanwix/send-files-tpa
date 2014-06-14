'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload, $http) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;

    /* Regular expression used to verify user input is a full name. */
    $scope.mailRegex = ''; //figure this out - just check for first name and last name but allow for middle or other names

    /* Constants used for byte conversion. */
    var GBbytes = 1073741824;
    var MBbytes = 1048576;

    /* Represents the Instance ID of this widget. */
    var instanceID = $wix.Utils.getInstanceId();

    /* Represents the user settings for the widget. */
    $scope.settings = {};

    /* Represents the current session ID of this widget. */
    $scope.sessionId = '';

    /* If true, invalid name message is shown. */
    $scope.showInvalidName = false;

    /* If true, invalid email message is shown. */
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

    /* Data to be sent to server when the user submits. */
    var finalSubmission = {'name': '',
                           'email': '',
                           'message': '',
                           'toUpload': $scope.uploadedFiles
                          };

    /* Records the visitor's name and updates final message to server. */
    $scope.$watch('name', function(visitorName) {
      finalSubmission.name = visitorName;
    });

    /* Records the visitor's email and updates final message to server. */
    $scope.$watch('email', function(visitorEmail) {
      finalSubmission.email = visitorEmail;
    });

    /* Records the visitor's message and updates final message to server. */
    $scope.$watch('message', function(visitorMessage) {
      finalSubmission.message = visitorMessage;
    });

    /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function() {
      if ($scope.fileForm.name.$invalid) {
        $scope.showInvalidName = true;
      }

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
      $scope.showInvalidName = false;
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
          
          $scope.start(fileIndex);
          fileIndex += 1;
        }
        console.log(fileIndex); //for error checking;
      }
    };

    /* Call this when the file at INDEX of fileList is ready 
     * to be sent to the server.
     */
    $scope.start = function(index) {
      $scope.progress[index] = 0;

      console.log(index);
      var uploadURL = '/api/files/upload?sessionId=' + $scope.sessionId;
      //verify the URL
      $scope.upload[index] = $upload.upload({
        url: uploadURL,
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
            var uploadVerified = {'fileId' : data}; //make sure this the actual format
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
      var uploadedFileTemp = [];
      var j = 0;
      for (var i = 0; i < $scope.uploadedFiles.length; i++) {
        if ($scope.uploadedFiles[i] !== null) {//check if it should be !=
          uploadedFileTemp[j] = $scope.uploadedFiles[i];
          j += 1;
        }
      }
      finalSubmission.toUpload = uploadedFileTemp;
      var uploadURL = '/api/files/upload?sessionId=' + $scope.sessionId;
      $http({method: 'POST',
             url: uploadURL,
             headers: {'x-wix-instance' : instanceID},
             data: finalSubmission
             // timeout: in milliseconds
      }).success(function(data, status, headers, config) {
          if (status === 202) {
            $scope.success();
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function(data, status, headers, config) {
          $scope.uploadFailed();
      });
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

    /* This setting makes a call to the backend database to get the
     * latest user settings. */
    $scope.getDatabaseSettings = function() {
      var compID = $wix.Utils.getOrigCompId();
      var urlDatabase = '/api/settings/' + compID;
      $http({method: 'GET',
             url: urlDatabase,
             headers: {'x-wix-instance' : instanceID}
             // timeout: in milliseconds
      }).success(function(data, status, headers, config) {
          if (status === 200) { //check if this is right status code
            $scope.settings = data.widgetSettings.settings;
            $scope.sessionId = data.widgetSettings.sessionId; //make sure this is the correct format
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function(data, status, headers, config) {
          //deal with errors
      });
    };

    $scope.settings = api.getSettings(true); //remove this eventually
    
    if (window.location.host === "editor.wix.com") {
      $scope.settings = api.getSettings(true);
    } else {
      $scope.getDatabaseSettings();
    }

  });
