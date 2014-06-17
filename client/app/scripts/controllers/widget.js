'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload, $http) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;

    /* Constants used for byte conversion. */
    var GBbytes = 1073741824;
    var MBbytes = 1048576;

    /* Upper limit on total size of files that can be uploaded. */
    var uploadLimit = GBbytes;

    /* Represents the Instance ID of this widget. */
    var instanceID = $wix.Utils.getInstanceId();

    /* Represents the Component ID of this widget. */
    var compID = $wix.Utils.getOrigCompId();

    /* Represents the user settings for the widget. */
    $scope.settings = {};

    /* Represents the current session ID of this widget. */
    $scope.sessionId = '';

    /* Represents if the widget is active. */
    $scope.active = true;

    /* If true, no name message is shown. */
    $scope.showNoName = false;

    /* If true, invalid email message is shown. */
    $scope.showInvalidEmail = false;

    /* If true, "no message written" message is shown. */
    $scope.showNoMessage = false;

    /* If true, "no file chosen" message is shown. */
    $scope.showNoFile = false;

    /* If true, upload failure messages are shown. */
    $scope.uploadFailed = false;

    /* Total size of all uploaded files so far in Bytes. */
    $scope.totalBytes = 0;

    /* Total space left for user to upload files in GB. */
    $scope.totalGBLeft = (uploadLimit - $scope.totalBytes) / GBbytes;

    /* Used to keep track of the number of files uploaded and their
     * place in various arrays. */
    var fileIndex = 0;

    /* Represents the total amount of files added by the visitor - but not
     * necessarily uploaded to the server yet. */
    $scope.totalFilesAdded = 0;

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

    /* True if Google Drive and server has at least 1GB of space. */
    var spaceVerified = false;

    /* Data to be sent to server when the user submits. */
    var finalSubmission = {'visitorName': '',
                           'email': '',
                           'message': '',
                           'toUpload': $scope.uploadedFiles
                          };

    /* Records the visitor's name and updates final message to server. */
    $scope.updateVisitorName = function (newValue) {
      finalSubmission.visitorName = newValue;
    };

    /* Records the visitor's email and updates final message to server. */
    $scope.updateEmail = function (newValue) {
      finalSubmission.email = newValue;
    };

    /* Records the visitor's message and updates final message to server. */
    $scope.updateMessage = function (newValue) {
      finalSubmission.message = newValue;
    };

    /* Watches for changes in toal space visitor has left to upload files. */
    $scope.$watch('totalBytes', function () {
      $scope.totalGBLeft = (uploadLimit - $scope.totalBytes) / GBbytes;
      if ($scope.totalBytes !== 0) {
        $scope.totalGBLeft -= $scope.totalGBLeft%0.01;
      }
    });

    /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function() {
      if ($scope.fileForm.visitorName.$invalid) {
        $scope.showNoName = true;
      }

      if ($scope.fileForm.email.$invalid) {
        $scope.showInvalidEmail = true;
      }
      if ($scope.fileForm.message.$invalid) {
        $scope.showNoMessage = true;
      }
      if (!($scope.totalFilesAdded)) {
        $scope.marginStyle = {'margin-bottom': 0};
        $scope.showNoFile = true;
      }
    };

    /* Call this to get error messages to disappear. */
    $scope.disableErrorMessage = function() {
      $scope.showNoName = false;
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
      // add some total bytes display
      for(var i = 0; i < $files.length; i++) {
        $scope.totalFilesAdded += 1;
        var file = $files[i];
        if (file.size > uploadLimit) { //Test with files almost 1GB
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
      for (var i = 0; i < $files.length; i++) {
        $scope.totalFilesAdded += 1;
        var file = $files[i];
        if ($scope.totalBytes + file.size > uploadLimit) {
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
          $scope.totalBytes += file.size;
          
          $scope.start(fileIndex);
          fileIndex += 1;
        }
        console.log(fileIndex); //for error checking;
      }
    };

    /* Sends a request to the server to check if the Google Drive
     * has enough storage space. */
    $scope.verifySpace = function() {
      var verifyURL = ''; //wait for this
      $http({method: 'GET',
             url: verifyURL,
             headers: {'X-Wix-Instance' : instanceID}
             // timeout: in milliseconds
        }).success(function (data, status, headers, config) {
          if (status === 200) {
            return true;
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function (data, status, headers, config) {
          return false;
          //fail everything - tell user that owner has not enough space.
      });
     }

    /* Call this when the file at INDEX of fileList is ready 
     * to be sent to the server.
     */
    $scope.start = function(index) {
      $scope.progress[index] = 0;

      console.log(index);

      if (index === 0) {
        spaceVerified = $scope.verifySpace();
      }
      if (spaceVerified) {
        //make some function that check for upload space before uploading
        var uploadURL = '/api/files/upload/' + compID + '?sessionId=' + $scope.sessionId;
        $scope.upload[index] = $upload.upload({
          url: uploadURL,
          method: 'POST',
          headers: {'X-Wix-Instance' : instanceID},
          file: $scope.fileList[index] //could technically upload all files - but only supported in HTML 5
        }).progress(function(evt) {
          console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total, 10));
          $scope.progress[index] = Math.min(95, parseInt(95.0 * evt.loaded / evt.total, 10));
          //fill in other 100 when sucess
          /* Use this data to implment progress bar */
        }).success(function (data, status, headers, config) {
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
      }
    };

    /* Call this when user wants to remove file from list. */
    $scope.abort = function(index) { /* TODO: Pass in file in HTML somehow! */
      $scope.totalFilesAdded -= 1;
      $scope.upload[index].abort();
      $scope.upload[index] = null;
      $scope.uploadedFiles[index] = null;
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
      var uploadURL = '/api/files/send/' + compID + '?sessionId=' + $scope.sessionId;
      $http({method: 'POST',
             url: uploadURL,
             headers: {'X-Wix-Instance' : instanceID},
             data: finalSubmission
             // timeout: in milliseconds
      }).success(function(data, status, headers, config) {
          if (status === 202) {
            $scope.success();
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function(data, status, headers, config) {
          $scope.initiateFailure();
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
    // $scope.getDatabaseSettings = function() {
    //   var urlDatabase = '/api/settings/' + compID;
    //   $http({method: 'GET',
    //          url: urlDatabase,
    //          headers: {'X-Wix-Instance' : instanceID}
    //          // timeout: in milliseconds
    //   }).success(function (data, status, headers, config) {
    //       if (status === 200) { //check if this is right status code
    //         if (data.widgetSettings.provider === "" || data.widgetSettings.settings.email === "") {
    //           $scope.active = false;
    //         }
    //         $scope.settings = data.widgetSettings.settings;
    //         $scope.sessionId = data.widgetSettings.sessionId; //make sure this is the correct format
    //       } else {
    //         console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
    //       }
    //     }).error(function (data, status, headers, config) {
    //       //deal with errors
    //   });
    // };

    $scope.settings = api.getSettings(true); //remove this eventually

    // if (window.location.host === "editor.wix.com") {
    //   $scope.settings = api.getSettings(true);
    // } else {
    //   $scope.getDatabaseSettings();
    // }

  });
