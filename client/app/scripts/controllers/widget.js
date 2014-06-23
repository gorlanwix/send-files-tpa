'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload, $http, $location) {

     /* Regular expression used to determine if user input is a valid email. */
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
    
    /* Constants used for byte conversion. */
    var GBbytes = 1073741824;
    var MBbytes = 1048576;

    /* Upper limit on total size of files that can be uploaded. */
    $scope.uploadLimit = GBbytes;

    /* Total size of all uploaded files so far in Bytes. */
    $scope.totalBytes = 0;

    /* Total space left for user to upload files in GB. */
    $scope.totalGBLeft = ($scope.uploadLimit - $scope.totalBytes) / GBbytes;

    /* Represents the total amount of files added by the visitor - but not
     * necessarily uploaded to the server yet. */
    $scope.totalFilesAdded = 0;

    /* Max amount of files than can be uploaded at a time. */
    $scope.maxFileLimit = 50;

    /* Represents the Instance ID of this widget. */
    var instanceID = 'whatever';
    // var url = $location.absUrl();
    // var instanceRegexp = /.*instance=([\[\]a-zA-Z0-9\.\-_]*?)(&|$|#).*/g;
    // var instance = instanceRegexp.exec(url);
    // if (instance && instance[1]) {
    //   instanceID = instance[1];
    // } else {
    //   console.log('All hell has broken loose.');
    //   //BREAK STUFF! THIS SHOULD NEVER HAPPEN.
    // }
    // console.log(instanceID);

    /* Represents the Component ID of this widget. */
    var compID = '12345';
    //$wix.Utils.getOrigCompId();

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

    /* Used to represent number of files tha that have been uploaded
     * successfully or returned an error from the server.
     */
    $scope.totalSuccess = 0;
    $scope.totalFailed = 0;

    $scope.submitting = false;
    $scope.submitted = false;

    /* Tell upload function to get a sessionID before processing and
     * uploading files.
     */
    var firstTimeUploading = true;

    /* Used to keep track of the number of files uploaded and their
     * place in various arrays. */
    var fileIndex = 0;

    /* List of files. Initalized as empty list. */
    $scope.fileList = [];

    /* List of files that can't be uploaded due to size limit or 
    * max file amount limit being reached. */
    $scope.overloadedList = [];

    /* A list of files that have gone through the upload process.
     * This list is used for keeping track of files. Used for when
     * the user chooses to remove a file from the list. */
    $scope.upload = [];

     /* A list of numbers representing the progress of each file's
      * upload process. */
    $scope.progress = [];

    /* An array of length equal to the number of files with icons at certain 
     * indices. If an index has an icon, then either an error or success icon
     * is shown to the user. Otherwise, a file upload progress percentage is 
     * shown. */
    $scope.progressIcons = [];

    /* A list used to tell what files have been successfully uploaded. It is 
     * sent to the backend for verification when the user hits submit. The
     * objects in the array are carrying a fileID given by the backend when
     * the upload has been completed successfully.
     */
    $scope.uploadedFiles = [];

    /* A queue of files waiting to be uploaded. The queue is emptied and the
     * files are uploaded as soon as the session ID is acquired from 
     * verifySpace().
     */
    var fileUploadQueue = [];

    /* An alternate message that is displayed on the submit button that only
     * appears during file uploaidng to give messages to the user. */
    $scope.fileUploadSubmitText = $scope.settings.submitButtonText;

    /* Data to be sent to server when the user submits. */
    var finalSubmission = {"visitorName": "",
                           "visitorEmail": "",
                           "visitorMessage": "",
                           "fileIds": $scope.uploadedFiles
                          };

    /* Records the visitor's name and updates final message to server. */
    $scope.updateVisitorName = function (newValue) {
      finalSubmission.visitorName = newValue;
      if (newValue === undefined) {
        $scope.fileForm.visitorName.$invalid = true;
      } else {
        $scope.fileForm.visitorName.$invalid = false;
      }
    };

    /* Records the visitor's email and updates final message to server. */
    $scope.updateEmail = function (newValue) {
      finalSubmission.visitorEmail = newValue;
    };

    /* Records the visitor's message and updates final message to server. */
    $scope.updateMessage = function (newValue) {
      finalSubmission.visitorMessage = newValue;
      if (newValue === undefined) {
        $scope.fileForm.message.$invalid = true;
      } else {
        $scope.fileForm.message.$invalid = false;
      }
    };

    /* Watches for changes in toal space visitor has left to upload files. */
    $scope.$watch('totalBytes', function () {
      console.log('totalBytes is changing');
      $scope.totalGBLeft = ($scope.uploadLimit - $scope.totalBytes) / GBbytes;
    });

    $scope.$watch('uploadLimit', function () {
      console.log('uploadLimit is changing');
      $scope.totalGBLeft = ($scope.uploadLimit - $scope.totalBytes) / GBbytes;
    });

    $scope.viewStyle = function() {
      if ($scope.active) {

      }
    }

    $scope.formStyle = function() {
      if ($scope.submitting || $scope.submitted) {
        return {'opacity' : 0.3};
      } else {
        return {};
      }
    };

    /* A function to used to style the files list. Files that are loaded
     * successfully are given a green background, while a red background
     * means an error has occured. */
    $scope.fileStyle = function(index) {
      if ($scope.progressIcons[index] === true) {
        if (index === 0) {
          return {'border-top': 0, 'background-color': '#93C993'};
        } else {
          return {'background-color': '#93C993'};
        }
      } else if ($scope.progressIcons[index] === false) {
        if (index === 0) {
          return {'border-top': 0, 'background-color': '#FF9999'};
        } else {
          return {'background-color': '#FF9999'};
        }
      } else {
        return {};
      }
    };

    /* A function that is used to style the submit button. A red button is
     * displayed while an error exists, a yellow button during typical file
     * upload, and a green button after a successful upload. A unique message
     * is displayed on the button during each situation.
     */
    $scope.submitButtonStyle = function () {
      if ($scope.totalFilesAdded) {
        if ($scope.totalFailed > 0) {
          $scope.fileUploadSubmitText = 'Submit with errors';
          return {'background-color' : '#FF9999'};
        } else if ($scope.totalSuccess === $scope.totalFilesAdded) {
          $scope.fileUploadSubmitText = 'Files ready to submit!';
          return {'background-color' : '#93C993'};
        } else {
          $scope.fileUploadSubmitText = 'Loading...';
          return {'background-color' : '#FFFF99'};
        }
      } else {
        return {};
      }
    };

    /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function () {
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
    $scope.disableErrorMessage = function () {
      $scope.showNoName = false;
      $scope.showInvalidEmail = false;
      $scope.showNoMessage = false;
      $scope.marginStyle = {};
      $scope.showNoFile = false;
    };

    /* Determines if a user is ready to submit or not. Returns true if
     * NOT ready to submit and false if ready. */
    $scope.submitNotReady = function() {
      if (!($scope.fileForm.$invalid) && $scope.totalFilesAdded &&
            $scope.totalSuccess === $scope.totalFilesAdded) {
        if ($scope.submitting) {
          return true;
        } else {
          return false;
        }
      } else {
        return true;
      }
    };

    /* Call this  when users select file(s) to begin file upload.
     * Gets the session ID and verifies capacity with server before
     * file processing actually happens
     */
    $scope.onFileSelect = function($files) {
      if (firstTimeUploading) {
        firstTimeUploading = false;
        $scope.verifySpace(function() {
          $scope.processFiles($files);
          for (var i = 0; i < fileUploadQueue.length; i++) {
            console.log('processing queue: ' + i);
            $scope.processFiles(fileUploadQueue[i]);
          }
        }, $files);
      } else if ($scope.sessionId) {
        console.log('got sessionID');
        $scope.processFiles($files);
      } else {
        console.log('Is this happening???');
        fileUploadQueue.push($files);
      }
    };

    /* Processes each file to verify that uploading it will not violate
     * the capacity limit or the maximum file total limit. Once that it is
     * confirmed, the function calls the upload function on each file.
     */
    $scope.processFiles = function($files) {
      for (var i = 0; i < $files.length; i++) {
        var file = $files[i];
        if ($scope.totalBytes + file.size > $scope.uploadLimit ||
            $scope.totalFilesAdded + 1 > $scope.maxFileLimit) {
          console.log("overload!");
          file.newSize = (Math.ceil(file.size / GBbytes * 100) / 100).toString() + 'GB';
          $scope.overloadedList.push(file);
        } else {
          $scope.totalFilesAdded += 1;
          $scope.totalBytes += file.size;

          var sizeInMB = Math.floor(file.size / MBbytes);
          if (sizeInMB === 0) {
            file.newSize = ' 1MB';
          } else {
            file.newSize = sizeInMB.toString() + 'MB';
          }
          $scope.progress[fileIndex] = 100;

          $scope.fileList.push(file);
          fileIndex += 1; //Increment first because not fast enough after $http
          $scope.start(fileIndex);
        }
      }
    };

    /* Sends a request to the server to check if the Google Drive
     * has enough storage space. */
    $scope.verifySpace = function(callback) {
      console.log("compID: " + compID);
      var verifyURL = '/api/files/session/' + compID; //wait for this
      $http({method: 'GET',
             url: verifyURL,
             headers: {'X-Wix-Instance' : instanceID},
             timeout: 10000
        }).success(function (data, status, headers, config) {
          if (status === 200) {
            console.log("upload capacity is: " + data.uploadSizeLimit);
            $scope.uploadLimit = data.uploadSizeLimit;
            $scope.uploadLimit = GBbytes; //DELETE THIS WHEN ANDREY FIXES CAPACITY
            console.log("upload capacity is: " + $scope.uploadLimit);
            $scope.sessionId = data.sessionId;
            callback();
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function (data, status, headers, config) {
          console.log('Could not get sessionID');
          //fail everything - tell user that owner has not enough space.
          //probably should try to verify again! - but keep track of number of retrys with variable - only retry two times
          //MAKE SURE IT IS IMPOSSIBLE FOR USER TO CONTINUE UPLOADING FILES
      });
     }

    /* Call this when the file at INDEX of fileList is ready 
     * to be sent to the server.
     * Note: Progress starts at 100 because the progress bar is
     * "uncovered" as progress goes on so by completion, the 
     * HTML element covering the progress bar has a width of 0.
     */
    $scope.start = function(index) {
      index -= 1; //IMPORTANT
      console.log('this is the index: ' + index);
      if ($scope.upload[index] !== 'aborted') {
        var uploadURL = '/api/files/upload/' + compID + '?sessionId=' + $scope.sessionId;
        $scope.upload[index] = $upload.upload({
          url: uploadURL,
          method: 'POST',
          headers: {'X-Wix-Instance' : instanceID},
          file: $scope.fileList[index] //could technically upload all files - but only supported in HTML 5
        }).progress(function(evt) {
          $scope.progress[index] = (100 - Math.min(95, parseInt(95.0 * evt.loaded / evt.total, 10)));
          //fill in other 100 when sucess
          /* Use this data to implment progress bar */
        }).success(function (data, status, headers, config) {
            //assuming data is the temp ID
            if (status === 201) {
              //var uploadVerified = {'fileId' : data.fileI}; //make sure this the actual format
              if ($scope.uploadedFiles[index] !== 'aborted') {
                $scope.uploadedFiles.push(data.fileId);
                $scope.progress[index] = 0;
                $scope.progressIcons[index] = true;
                $scope.totalSuccess += 1;
              }
            } else {
              console.log('ERROR ERROR ERROR: success failed!');
            }
        }).error(function(data, status, headers, config) {
            if ($scope.uploadedFiles[index] !== 'aborted') {
              $scope.progressIcons[index] = false;
              $scope.totalFailed += 1;
            }
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
    $scope.abort = function(index) {
      //test if you can get program to crash by aborting before the upload even occurs
      $scope.uploadedFiles[index] = 'aborted';
      $scope.totalFilesAdded -= 1;
      if ($scope.progressIcons[index] === false) {
        $scope.totalFailed -= 1;
      }
      if ($scope.progressIcons[index] === true) {
        $scope.totalSuccess -= 1;
      }
      if ($scope.upload[index] !== undefined) {
        $scope.upload[index].abort();
      }
      $scope.upload[index] = 'aborted';
      $scope.totalBytes -= $scope.fileList[index].size;
    };

    $scope.submit2 = function() {
      var uploadedFileTemp = [];
      var j = 0;
      for (var i = 0; i < $scope.uploadedFiles.length; i++) {
        if ($scope.uploadedFiles[i] !== "aborted") {//check if it should be !=
          uploadedFileTemp[j] = $scope.uploadedFiles[i];
          j += 1;
        }
      }
      console.log('length: ' + uploadedFileTemp.length);
      $scope.uploadFailed = true;
    };


    /* Call this when user submits form with files, email, and message */
    $scope.submit = function() {
      $scope.submitting = true;
      var uploadedFileTemp = [];
      var j = 0;
      for (var i = 0; i < $scope.uploadedFiles.length; i++) {
        if ($scope.uploadedFiles[i] !== "aborted") {//check if it should be !=
          uploadedFileTemp[j] = $scope.uploadedFiles[i];
          j += 1;
        }
      }
      finalSubmission.fileIds = uploadedFileTemp;
      finalSubmission.visitorName = finalSubmission.visitorName.trim();
      finalSubmission.visitorEmail = finalSubmission.visitorEmail.trim();
      finalSubmission.visitorMessage = finalSubmission.visitorMessage.trim();
      var uploadURL = '/api/files/send/' + compID + '?sessionId=' + $scope.sessionId;
      $http({method: 'POST',
             url: uploadURL,
             headers: {'X-Wix-Instance' : instanceID},
             data: finalSubmission,
             timeout: 10000
      }).success(function(data, status, headers, config) {
          if (status === 202) {
            $scope.success();
            //deal with capacity errors (google drive ran out of space as we
              //were uploading after the verification) status: 400
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function(data, status, headers, config) {
          console.log('submited and failed');
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
      $scope.submitting = false;
      //call this only if submit fails
      $scope.uploadFailed = true;

      //could instatiate this function with a specific error message for the user
      //would just change some scope variable to function argument
    };
    /* Call this to reset widget after widget upload fail/success.
     * All failure/success messages will disappear and most variables are
     * completly reset. */
    $scope.reset = function() {
      firstTimeUploading = true;

      $scope.totalSuccess = 0;
      $scope.totalFailed = 0;
      $scope.submitting = false;
      $scope.submitted = false;

      $scope.fileForm.visitorName.$invalid = true;
      $scope.fileForm.email.$invalid = true;
      $scope.fileForm.message.$invalid = true;
      
      fileIndex = 0;
      $scope.uploadLimit = GBbytes;
      $scope.totalBytes = 0;
      $scope.totalFilesAdded = 0;
      $scope.fileList = [];
      $scope.overloadedList = [];
      $scope.upload = [];
      $scope.progress = [];
      $scope.progressIcons = [];
      $scope.uploadedFiles = [];
      fileUploadQueue = [];

      $scope.uploadFailed = false;
    };

    /* Call this to show success widget after widget upload.
     * A "Add more files" Button will appear to allow the user
     * to upload more files. */
    $scope.success = function() {
      $scope.submitted = true;
      $scope.submitting = false;
    };

    /* This setting makes a call to the backend database to get the
     * latest user settings. */
    $scope.getDatabaseSettings = function() {
      var urlDatabase = '/api/settings/' + compID;
      $http({method: 'GET',
             url: urlDatabase,
             headers: {'X-Wix-Instance' : instanceID},
             timeout: 10000
      }).success(function (data, status, headers, config) {
          if (status === 200) { //check if this is right status code
            if (data.widgetSettings.provider === "" || data.widgetSettings.userEmail === "") {
              $scope.active = false;
            }
            console.log(data.widgetSettings.userEmail);
            if (Object.getOwnPropertyNames(data.widgetSettings.settings).length !== 0) {
              $scope.settings = data.widgetSettings.settings;
            } else {
              $scope.settings = api.getSettings(api.defaults);
            }
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
            $scope.settings = api.getSettings(api.defaults);
          }
        }).error(function (data, status, headers, config) {
          //deal with errors including timeout
          $scope.settings = api.getSettings(api.defaults);
      });
    };

    //This block below listens for changes in the settings panel and updates the widget view.
    $wix.addEventListener($wix.Events.SETTINGS_UPDATED, function(message) {
      $scope.settings = message;
      // console.log('Input Data: ', message); //for testing communication between widget and settings
      $scope.$apply();
    });

    $scope.getDatabaseSettings();

  });


