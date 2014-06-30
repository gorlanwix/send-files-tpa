'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, $wix, $upload, $http, $location, $timeout) {

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
    $scope.maxFileLimit = 60;

    /* Represents the Instance ID of this widget. */

    var instance = 'whatever';//api.getInstance();//'whatever';
    // var url = $location.absUrl();
    // var instanceRegexp = /.*instance=([\[\]a-zA-Z0-9\.\-_]*?)(&|$|#).*/g;
    // var instance = instanceRegexp.exec(url);
    // if (instance && instance[1]) {
    //   instanceId = instance[1];
    // } else {
    //   console.log('All hell has broken loose.');
    //   //BREAK STUFF! THIS SHOULD NEVER HAPPEN.
    // }
    // console.log(instanceId);
    console.log('hello' + api.getInstance());

    /* Represents the Component ID of this widget. */
    var compId = '[UNKNOWN]'; //$wix.Utils.getOrigCompId() || $wix.Utils.getCompId();
    console.log(compId);

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

    /* If true, show overload file popup. */
    $scope.showOverloadedPopup = false;

    /* If true, show files that have failed to upload popup. */
    $scope.showFailedUploadPopup = false;

    /* If true, show the warning to user that they are submitting with errored
     * files.
     */
    $scope.showErrorWarningPopup = false;

    /* If true, show the message that you can't submit while files
     * are loading.
     */
    $scope.showLoadingPopup = false;

    /* If true, file upload messages are shown in the file status bar. */
    $scope.showFileUploadMessage = false;

    /* If true, error message from verification check will show up. */
    $scope.showVerifyErrorPopup = false;

    /* Used to represent number of files tha that have been uploaded
     * successfully or returned an error from the server.
     */
    $scope.totalSuccess = 0;
    $scope.totalFailed = 0;

    /* Represents the possible submit stages. At various stages, messages
     * are shown to the user. */
    $scope.submitting = false;
    $scope.submitSuccessful = false;
    $scope.submitFailed = false;

    /* True if the user is currently dropping a file onto the widget. */
    $scope.dropping = false;

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

    /* A list of indices representing files that need to be reuploaded
     * due to failures.
     */
    $scope.uploadRetryList = [];

    /* A list of indices representing files that have failed to upload
     * even after 5 additional retry attempts.
     */
    $scope.failedAfterRetryList = [];

    /* While true, elements in the list of files that the user wants retried
     * are being processed. During this time, the failed upload popup is not
     * allowed to show up. */
    var processingFailedAfterRetryList = false;

    /* A list of files waiting to be shown to the user as files that failed
     * to upload. They are shown once the current list has been processed. */
    var retryQueue = [];

    /* An alternate message that is displayed on the submit button that only
     * appears during file uploaidng to give messages to the user. */
    $scope.fileUploadSubmitText = $scope.settings.submitButtonText;

    /* Data to be sent to server when the user submits. */
    var finalSubmission = {visitorName: {first: '', last: ''},
                           visitorEmail: '',
                           visitorMessage: '',
                           fileIds: $scope.uploadedFiles,
                           wixSessionToken : null
                          };

    /* Records the visitor's name and updates final message to server. */
    $scope.updateVisitorName = function (newValue) {
      finalSubmission.visitorName.first = newValue;
    };

    /* Records the visitor's email and updates final message to server. */
    $scope.updateEmail = function (newValue) {
      finalSubmission.visitorEmail = newValue;
    };

    /* Records the visitor's message and updates final message to server. */
    $scope.updateMessage = function (newValue) {
      finalSubmission.visitorMessage = newValue;
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

    /* Changes the opacity of the entire widget. Used for when the app is not
     * yet active.
     */
    $scope.viewStyle = function() {
      if (!$scope.active ||
          $scope.showOverloadedPopup ||
          $scope.submitSuccessful ||
          $scope.showFailedUploadPopup ||
          $scope.submitFailed || $scope.dropping) {
        return {'opacity' : 0.5};
      } else {
        return {};
      }
    };

    $scope.dropStyle = function() {
      if ($scope.settings.borderWidth === 1) {
        return {'height' : '90%', 'width' : '90%', 'top' : '5%', 'left' : '5%'};
      } else if ($scope.settings.borderWidth === 3) {
        return {'height' : '90%', 'width' : '85%', 'top' : '5%', 'left' : '6%'};
      } else if ($scope.settings.borderWidth === 5) {
        return {'height' : '85%', 'width' : '80%', 'top' : '7%', 'left' : '8%'};
      } else {
        return {'height' : '85%', 'width' : '80%', 'top' : '6%', 'left' : '8%'};
      }
    };

    /* Used to change some of the form's opacity. Used for when submitting
     * and displaying submit sucessful message.
     */
    $scope.formStyle = function() {
      if ($scope.submitting) {
        return {'opacity' : 0.5};
      } else {
        return {};
      }
    };

    /* A function to used to style the files list. Files that are loaded
     * successfully are given a green background, while a red background
     * means an error has occured. */
    $scope.fileStyle = function(index) {
      if ($scope.fileList[index].uploadResult === true) {
        if (index === 0) {
          return {'border-top': 0, 'background-color': '#93C993', 'border-bottom': 0};
        } else {
          return {'background-color': '#93C993', 'border-bottom': 0};
        }
      } else if ($scope.fileList[index].uploadResult === false) {
        if (index === 0) {
          return {'border-top': 0, 'background-color': '#FF9999', 'border-bottom': 0};
        } else {
          return {'background-color': '#FF9999', 'border-bottom': 0};
        }
      } else {
        return {};
      }
    };

    $scope.fileNameStyle = function(index) {
      if ($scope.fileList[index].uploadResult !== undefined) {
        return {'max-width': '86%'};
      } else {
        return {};
      }
    };

    $scope.successTextStyle = function () {
      if ($scope.totalFilesAdded - $scope.totalSuccess ||
          $scope.showFileUploadMessage) {
        return {'border-right' : '1px solid #838486'};
      } else {
        return {};
      }
    };

    $scope.failedTextStyle = function () {
      if ($scope.totalFilesAdded - $scope.totalFailed - $scope.totalSuccess ||
          $scope.showFileUploadMessage) {
        return {'border-right' : '1px solid #838486'};
      } else {
        return {};
      }
    };

    $scope.loadingTextStyle = function () {
      if ($scope.showFileUploadMessage) {
        return {'border-right' : '1px solid #838486'};
      } else {
        return {};
      }
    };

    /* Call this to get error messages to show up if the form
     * is filled out incorrectly. */
    $scope.enableErrorMessage = function () {
      if ($scope.active) {
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
          $scope.fileMessage = 'Please add a file';
          $scope.showNoFile = true;
        }
        if (!$scope.showNoName && !$scope.showInvalidEmail &&
            !$scope.showNoMessage && !$scope.showNoFile &&
            !($scope.totalFilesAdded - $scope.totalSuccess - $scope.totalFailed)
            ) {
          $scope.showLoadingPopup = true;
        }
      } else {
        $scope.marginStyle = {'margin-bottom': 0};
        $scope.fileMessage = 'Please activate the app in the settings';
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
      $scope.showFileUploadMessage = false;
      $scope.showLoadingPopup = false;
    };

    /* Handles all popup button clicks and responds appropriately based
     * on the user's choice and the situation. */
    $scope.handlePopup = function (situation) {
      if (situation.type === 'overload') {
        $scope.showOverloadedPopup = false;
        $scope.overloadedList = [];
      } else if (situation.type === 'failed upload') {
        if (situation.reply === 'yes') {
          $scope.showFailedUploadPopup = false;
          processingFailedAfterRetryList = true; //important!
          while ($scope.failedAfterRetryList.length > 0) {
            var indexValue = $scope.failedAfterRetryList.splice(0, 1);
            $scope.retry(indexValue[0]);
          }
        } else {
          $scope.showFailedUploadPopup = false;
          $scope.failedAfterRetryList = [];
        }
      } else if (situation.type === 'error warning') {
        console.log('situation:');
        console.log(situation.reply);
        console.log(situation.reply === 'yes');
        if (situation.reply === 'yes') {
          $scope.showErrorWarningPopup = false;
          preSubmit();
        } else {
          $scope.showErrorWarningPopup = false;
        }
      } else if (situation.type === 'failed submit') {
        $scope.submitFailed = false;
        $scope.showSubmitFailedPopup = false;
        if (situation.reply === 'try again') {
          preSubmit();
        } else {
          $scope.reset();
        }
      }
    };

    /* Determines if a user is ready to submit or not. Returns true if
     * NOT ready to submit and false if ready. */
    $scope.submitNotReady = function() {
      if (!($scope.fileForm.$invalid) && $scope.totalFilesAdded &&
            (($scope.totalSuccess + $scope.totalFailed ) ===
            $scope.totalFilesAdded) && $scope.totalSuccess) {
        return false;
      } else {
        return true;
      }
    };

    /* Call this  when users select file(s) to begin file upload.
     * Gets the session ID and verifies capacity with server before
     * file processing actually happens
     */
    $scope.onFileSelect = function($files) {
      if ($scope.active && !$scope.submitting &&
          !$scope.submitSuccessful && !$scope.submitFailed) {
        if (firstTimeUploading) {
          console.log('running');
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
          $scope.showOverloadedPopup = true;
        } else {
          $scope.totalFilesAdded += 1;
          $scope.totalBytes += file.size;

          var sizeInMB = Math.floor(file.size / MBbytes);
          if (sizeInMB === 0) {
            file.newSize = ' 1MB';
          } else {
            file.newSize = sizeInMB.toString() + 'MB';
          }

          $scope.fileList.push(file);
          $scope.fileList[fileIndex].progress = 100;
          fileIndex += 1; //Increment first because not fast enough after $http
          $scope.start(fileIndex);
        }
      }
    };

    /* Sends a request to the server to check if the Google Drive
     * has enough storage space. */
    $scope.verifySpace = function(callback) {
      console.log("compId: " + compId);
      var verifyURL = '/api/files/session/' + compId; //wait for this
      $http({method: 'GET',
             url: verifyURL,
             headers: {'X-Wix-Instance' : instance},
             timeout: 10000
        }).success(function (data, status, headers, config) {
          if (status === 200) {
            console.log("upload capacity is: " + data.uploadSizeLimit);
            $scope.uploadLimit = data.uploadSizeLimit;
        
            //$scope.uploadLimit = 0; //DELETE THIS

            console.log("upload capacity is: " + $scope.uploadLimit);
            $scope.sessionId = data.sessionId;
            callback();
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function (data, status, headers, config) {
          console.log('Could not get sessionID');
          console.log(status);
          if (status === 401) {
            $scope.verifyErrorMessage = 'We are not accepting files' +
                                        ' at this time. Please contact us.';
          }
          $scope.verifyErrorMessage = 'Something terrible happened. Try again.';
          firstTimeUploading = true;
          $scope.showVerifyErrorPopup = true;
          $timeout(function() {
            $scope.showVerifyErrorPopup = false;
          }, 2000);
      });
     };

    /* Call this when the file at INDEX of fileList is ready 
     * to be sent to the server.
     * Note: Progress starts at 100 because the progress bar is
     * "uncovered" as progress goes on so by completion, the 
     * HTML element covering the progress bar has a width of 0.
     */
    var totalruns = 0;
    $scope.start = function(index) {
      totalruns += 1;
      index -= 1; //IMPORTANT
      console.log('this is the index: ' + index);
      if ($scope.upload[index] !== 'aborted') {
        var uploadURL = '/api/files/upload/' + compId + '?sessionId=' + $scope.sessionId;
        $scope.upload[index] = $upload.upload({
          url: uploadURL,
          method: 'POST',
          headers: {'X-Wix-Instance' : instance},
          file: $scope.fileList[index] //could technically upload all files - but only supported in HTML 5
        }).progress(function(evt) {
          $scope.fileList[index].progress = (100 - Math.min(95, parseInt(95.0 * evt.loaded / evt.total, 10)));
          //fill in other 100 when sucess
          /* Use this data to implment progress bar */
        }).success(function (data, status, headers, config) {
            //assuming data is the temp ID
            if (status === 201) {
              //var uploadVerified = {'fileId' : data.fileI}; //make sure this the actual format
              if ($scope.uploadedFiles[index] !== 'aborted') {
                $scope.fileList[index].retryMessage = undefined;
                if ($scope.failedAfterRetryList.length === 0) {
                  processingFailedAfterRetryList = false;
                  if (retryQueue.length > 0) {
                    for (var i = 0; i < retryQueue.length; i++) {
                      $scope.failedAfterRetryList[i] = retryQueue[i];
                    }
                    retryQueue = [];
                    $scope.showFailedUploadPopup = true;
                  }
                }
                $scope.uploadedFiles.push(data.fileId);
                $scope.fileList[index].progress = 0;
                $scope.fileList[index].uploadResult = true;
                $scope.totalSuccess += 1;
                console.log('uploaded!');
                if ($scope.fileList[index].retry) {
                  $scope.totalFailed -= 1;
                }
                console.log("uploaded count: " + $scope.uploadedFiles.length);
                console.log($scope.uploadRetryList);
              }
            } else {
              console.log('ERROR ERROR ERROR: success failed!');
            }
        }).error(function(data, status, headers, config) {
            if ($scope.failedAfterRetryList.length === 0) {
              processingFailedAfterRetryList = false;
              if (retryQueue.length > 0) {
                for (var i = 0; i < retryQueue.length; i++) {
                  $scope.failedAfterRetryList[i] = retryQueue[i];
                }
                retryQueue = [];
                $scope.showFailedUploadPopup = true;
              }
            }
            console.log('upload index value:');
            console.log($scope.upload[index]);
            if ($scope.uploadedFiles[index] !== 'aborted') {
              $scope.fileList[index].uploadResult = false;
              if ($scope.fileList[index].retry !== true) {
                $scope.totalFailed += 1;
                $scope.fileList[index].retry = true;
              }
              var arrayPosition = $scope.uploadRetryList.map(
                function(elem) {
                  return elem.fileLocation;
                }).indexOf(index);
              if (arrayPosition < 0) {
                $scope.fileList[index].retryMessage = 'Failed: Auto-retrying - ';
                console.log('index: ' + index);
                console.log('reunning constantly' + arrayPosition);
                $scope.uploadRetryList.push(
                  {fileLocation: index,
                   numberOfTries: 1});
                $scope.retry(index);
              } else {
                if ($scope.uploadRetryList[arrayPosition].numberOfTries < 5) {
                  console.log($scope.uploadRetryList[arrayPosition].numberOfTries);
                  $scope.uploadRetryList[arrayPosition].numberOfTries += 1;
                  $scope.retry(index);
                } else {
                  $scope.fileList[index].retryMessage = 'Failed: click to retry - ';
                  console.log('RETRY REMOVAL: ' + ($scope.uploadRetryList[arrayPosition].numberOfTries + 1));
                  $scope.uploadRetryList.splice(arrayPosition, 1);
                  if (!processingFailedAfterRetryList) {
                    $scope.failedAfterRetryList.push(index);
                    $scope.showFailedUploadPopup = true;
                  } else {
                    retryQueue.push(index);
                  }
                }
                console.log('totalruns: ' + totalruns);
                console.log($scope.uploadRetryList);
              }
              console.log('failedAfterRetryList:');
              console.log($scope.failedAfterRetryList);
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

    $scope.retry = function(index) {
      console.log('restarting!');
      $scope.fileList[index].progress = 100;
      $scope.fileList[index].uploadResult = undefined;
      $scope.start(index + 1);
    };

    /* Call this when user wants to remove file from list. */
    $scope.abort = function(index) {
      //test if you can get program to crash by aborting before the upload even occurs
      $scope.uploadedFiles[index] = 'aborted';
      $scope.totalFilesAdded -= 1;
      if ($scope.fileList[index].uploadResult === false) {
        $scope.totalFailed -= 1;
      }
      if ($scope.fileList[index].uploadResult === true) {
        $scope.totalSuccess -= 1;
      }
      if ($scope.upload[index] !== undefined) {
        $scope.upload[index].abort();
      }
      $scope.upload[index] = 'aborted';
      $scope.totalBytes -= $scope.fileList[index].size;
    };

    //FOR TESTING - REMOVE THIS
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
      $scope.submitFailed = true;
    };

    /* Processes the submit request from the user accordingly. */
    $scope.submitProcessor = function () {
      if ($scope.totalFilesAdded !== $scope.totalSuccess) {
        $scope.showErrorWarningPopup = true;
      } else {
        preSubmit();
      }
    };

    /* Gets wix session token and then runs the submit function */
    var preSubmit = function() {
      if (!$scope.submitting) {
        $scope.submitting = true;
        console.log('you\'re trying to submit');
        $wix.Activities.getUserSessionToken(
            function OnSuccess(userToken) {
              finalSubmission.wixSessionToken = userToken;

              finalSubmission.wixSessionToken = 'diamond'; //FOR TESTING. REMOVE THIS

              console.log('I got the session token!');
              console.log(userToken);
              $scope.submit();
            });
      }
    };

    /* Call this when user submits form with files, email, and message */
    $scope.submit = function () {
      console.log('submitting!');
      var uploadedFileTemp = [];
      var j = 0;
      for (var i = 0; i < $scope.uploadedFiles.length; i++) {
        if ($scope.uploadedFiles[i] !== "aborted") {
          uploadedFileTemp[j] = $scope.uploadedFiles[i];
          j += 1;
        }
      }
      finalSubmission.fileIds = uploadedFileTemp;
      finalSubmission.visitorName.first = finalSubmission.visitorName.first.trim();
      finalSubmission.visitorEmail = finalSubmission.visitorEmail.trim();
      finalSubmission.visitorMessage = finalSubmission.visitorMessage.trim();
      var uploadURL = '/api/files/commit/' + compId + '?sessionId=' + $scope.sessionId;
      $http({method: 'POST',
             url: uploadURL,
             headers: {'X-Wix-Instance' : instance},
             data: finalSubmission,
             timeout: 10000
      }).success(function(data, status, headers, config) {
          if (status === 202) {
            $scope.submitting = false;
            $scope.submitSuccessful = true;
            $timeout(function() {
              $scope.reset();
            }, 2000);
            //deal with capacity errors (google drive ran out of space as we
              //were uploading after the verification) status: 400
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
          }
        }).error(function(data, status, headers, config) {
          console.log('submited and failed');
          if (status === 400 || status === 500) {
            $scope.submitErrorMessage = 'Something terrible happened. Try again.';
          } else if (status === 401) {
            $scope.submitErrorMessage = 'We are not accepting files at this time. Please contact us.';
          } else if (status === 413) {
            $scope.submitErrorMessage = 'The total file upload is too large. Remove a file and try again.';
          }
          $scope.submitting = false;
          $scope.submitFailed = true;
        });
    };

    /* Call this to reset widget after widget upload fail/success.
     * All failure/success messages will disappear and most variables are
     * completly reset. */
    $scope.reset = function() {
      $scope.visitorName = '';
      $scope.email = '';
      $scope.message = '';

      firstTimeUploading = true;

      $scope.totalSuccess = 0;
      $scope.totalFailed = 0;
      $scope.submitting = false;
      $scope.submitSuccessful = false;

      fileIndex = 0;
      $scope.uploadLimit = GBbytes;
      $scope.totalBytes = 0;
      $scope.totalFilesAdded = 0;
      
      $scope.fileList = [];
      $scope.overloadedList = [];
      $scope.upload = [];
      $scope.uploadedFiles = [];
      $scope.uploadRetryList = [];

      fileUploadQueue = [];

      $scope.submitFailed = false;
    };

    /* This setting makes a call to the backend database to get the
     * latest user settings. */
    $scope.getDatabaseSettings = function() {
      var urlDatabase = '/api/settings/' + compId;
      $http({method: 'GET',
             url: urlDatabase,
             headers: {'X-Wix-Instance' : instance},
             timeout: 10000
      }).success(function (data, status, headers, config) {
          if (status === 200) { //check if this is right status code
            console.log("code", data);
            if (!data.widgetSettings.provider ||
                !data.widgetSettings.userEmail) {
              //$scope.active = false;
            }
            console.log(data.widgetSettings.userEmail);
            if (data.widgetSettings.settings !== null &&
                Object.getOwnPropertyNames(data.widgetSettings.settings).length !== 0) {
              $scope.settings = data.widgetSettings.settings;
            } else {
              $scope.settings = api.defaults;
            }
          } else {
            console.log('WHAT. THIS ERROR SHOULD NEVER OCCUR.');
            $scope.settings = api.defaults;
          }
          console.log($scope.settings.buttonCorners);
        }).error(function (data, status, headers, config) {
          //deal with errors including timeout
          $scope.settings = api.defaults;
      });
    };

    //This block below listens for changes in the settings panel and updates the widget view.
    $wix.addEventListener($wix.Events.SETTINGS_UPDATED, function(message) {
      $scope.settings = message;
      console.log('hello world'); //DO BORDER AND BORDER RADIUS CHANGES HERE
      // console.log('Input Data: ', message); //for testing communication between widget and settings
      console.log('buttonCorners:', $scope.settings.buttonCorners);
      $scope.$apply();
    });

    $scope.getDatabaseSettings();
    console.log(compId);
  });


