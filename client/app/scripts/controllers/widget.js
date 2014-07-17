'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, internals, $wix, $upload, $http, $location, $timeout) {

     /**
      * Regular expression used to determine if user input is a valid email.
      * @type {Object - Regular Expression}
      */
    $scope.EMAIL_REGEX = internals.constants.EMAIL_REGEX;

    /**
     * Upper limit on total size of files that can be uploaded.
     * @type {Number}
     */
    var uploadLimit = internals.limits.uploadLimit;

    /**
     * Total size of all uploaded files so far in Bytes.
     * @type {Number}
     */
    $scope.totalBytes = 0;

    /**
     * Represents the total amount of files added by the visitor - but not
     * necessarily uploaded to the server yet.
     * @type {Number}
     */
    $scope.totalFilesAdded = 0;

    /**
     * Represents the Instance ID of this widget.
     * @type {String}
     */
    var instance = api.getInstance();//'whatever';

    /**
     * Represents the Component ID of this widget.
     * @type {String}
     */
    var compId = $wix.Utils.getOrigCompId() || $wix.Utils.getCompId();

    /**
     * Allows external package that does automatic scrolling of files list when
     * user adds new files to work.
     * @type {Boolean}
     */
    $scope.glued = true;

    /**
     * Represents the site owner's settings for the widget.
     * @type {Object}
     */
    $scope.settings = {};

    /**
     * Represents the current session ID of this widget.
     * @type {String}
     */
    $scope.sessionId = '';

    /**
     * Represents if the widget is active.
     * @type {Boolean}
     */
    $scope.active = true;

    /**
     * Various booleans used to determine what messages should be shown
     * to the user at any given time.
     * @type {Boolean}
     */
    $scope.showNoName = false;
    $scope.showInvalidEmail = false;
    $scope.showNoMessage = false;
    $scope.showNoFile = false;
    $scope.showOverloadedPopup = false;
    $scope.showFailedUploadPopup = false;
    $scope.showErrorWarningPopup = false;
    $scope.showLoadingPopup = false;
    $scope.showVerifyErrorPopup = false;

    /**
     * Represents the possible submit stages. At various stages, messages
     * are shown to the user.
     * @type {Boolean}
     */
    $scope.submitting = false;
    $scope.submitSuccessful = false;
    $scope.submitFailed = false;

    /**
     * Used to represent number of files tha that have been uploaded
     * successfully or returned an error from the server.
     * @type {Number}
     */
    $scope.totalSuccess = 0;
    $scope.totalFailed = 0;

    /**
     * True if the user is currently dropping a file onto the widget.
     * @type {Boolean}
     */
    $scope.dropping = false;

    /**
     * Used to tell upload function to get a sessionID before processing
     * and uploading files.
     * @type {Boolean}
     */
    var firstTimeUploading = true;

    /**
     * Used to keep track of the number of files uploaded and their
     * place in various arrays.
     * @type {Number}
     */
    var fileIndex = 0;

    /**
     * List of files uploaded by user.
     * @type {Array of files}
     */
    $scope.fileList = [];

    /**
     * List of files that can't be uploaded due to size limit or 
     * max file amount limit being reached.
     * @type {Array of files}
     */
    $scope.overloadedList = [];

    /**
     * A list of files that have gone through the upload process.
     * This list is consulted when the user chooses to remove a file.
     * @type {Array of Objects}
     * */
    $scope.upload = [];

    /**
     * A list used to tell what files have been successfully uploaded. It is 
     * sent to the backend for verification when the user hits submit. The
     * objects in the array are file IDs given by the backend when
     * the upload has been completed successfully.
     * @type {Array of Numbers}
     */
    $scope.uploadedFiles = [];

    /**
     * A queue of files waiting to be uploaded because the session ID hasn't
     * been acquired from the server yet. The files are uploaded as soon as
     * the session ID is acquired.
     * @type {Array of Arrays of Files}
     */
    var fileUploadQueue = [];

    /**
     * A list of indices representing files that need to be reuploaded
     * due to failures.
     * @type {Array of Numbers}
     */
    $scope.uploadRetryList = [];

    /**
     * A list of indices representing files that have failed to upload
     * even after 5 additional retry attempts.
     * @type {Array of Numbers}
     */
    $scope.failedAfterRetryList = [];

    /**
     * While true, elements in the list of files that the user wants retried
     * are being processed. During this time, the failed upload popup is not
     * allowed to show up.
     * @type {Boolean}
     */
    var processingFailedAfterRetryList = false;

    /* A list of indices representing files waiting to be shown to the user
     * as files that failed to upload. They are shown once the current list
     * has been processed.
     * They are not shown immediately to prevent annoying the user.
     * @type {Array of Numbers}
     */
    var retryQueue = [];

    /**
     * Data to be sent to server when the user submits.
     * @type {Object}
     */
    var finalSubmission = {visitorName: {first: '', last: ''},
                           visitorEmail: '',
                           visitorMessage: '',
                           fileIds: $scope.uploadedFiles,
                           wixSessionToken : null
                          };

    /**
     * Sets visitor name input to "untouched" when input is blank.
     * @param  {String} newValue Value in input
     */
    $scope.updateVisitorName = function (newValue) {
      if (newValue === undefined) {
        $scope.fileForm.visitorName.$setPristine();
      }
    };

    /**
     * Sets email input to "untouched" when input is blank.
     * @param  {String} newValue Value in input
     */
    $scope.updateEmail = function (newValue) {
      if (newValue === undefined) {
        $scope.fileForm.email.$setPristine();
      }
    };

    /**
     * Sets message input to "untouched" when input is blank.
     * @param  {String} newValue Value in input
     */
    $scope.updateMessage = function (newValue) {
      if (newValue === undefined) {
        $scope.fileForm.message.$setPristine();
      }
    };

    /**
     * Lowers the opacity of the entire widget. Used for when the app is not
     * yet active or there is a popup being displayed.
     */
    $scope.viewStyle = function() {
      if (!$scope.active || $scope.showOverloadedPopup ||
          $scope.showFailedUploadPopup || $scope.showErrorWarningPopup ||
          $scope.showLoadingPopup || $scope.showVerifyErrorPopup ||
          $scope.submitSuccessful || $scope.submitFailed ||
          $scope.dropping) {
        return {'opacity' : 0.5};
      } else {
        return {};
      }
    };

    /**
     * Used to change some of the form's opacity. Used for when submitting.
     * @return {Object} The resulting style
     */
    $scope.formStyle = function() {
      if ($scope.submitting) {
        return {'opacity' : 0.5};
      } else {
        return {};
      }
    };

    /**
     * A function to used to style the files list. Files that are loaded
     * successfully are given a green background, while a red background
     * means an error has occured.
     * @param {Number} index  The index of the file in fileList whose status
     *                        you are trying to display
     * @return {Object}       The resulting style
     * */
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

    /**
     * Used to style the files list. Used to prevent overflow issues from
     * file name being too long and spilling into progress area.
     * @param  {Number} index The index of the file in fileList whose display
     *                        you are trying to change
     * @return {Object}       The resulting style
     */
    $scope.fileNameStyle = function(index) {
      if ($scope.fileList[index].uploadResult !== undefined) {
        return {'max-width': '86%'};
      } else {
        return {};
      }
    };

    /**
     * Call this to get error messages to show up if the form
     * is filled out incorrectly.
     */
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
        $scope.showNoFile = true;
      }
      if (!$scope.showNoName && !$scope.showInvalidEmail &&
          !$scope.showNoMessage && !$scope.showNoFile &&
          ($scope.totalFilesAdded - $scope.totalSuccess - $scope.totalFailed)
          ) {
        $scope.showLoadingPopup = true;
      }
    };

    /**
     * Call this to get error messages to disappear.
     */
    $scope.disableErrorMessage = function () {
      $scope.showNoName = false;
      $scope.showInvalidEmail = false;
      $scope.showNoMessage = false;
      $scope.showNoFile = false;
      $scope.showLoadingPopup = false;
    };

    /**
     * Handles all popup button clicks and responds appropriately based
     * on the user's choice and the situation.
     * @param {Object} situation An object the descibes how a user is
     *                           reacting to a certain popup
     */
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
      if ($scope.active && $scope.fileForm.$valid &&
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
        if ($scope.totalBytes + file.size > uploadLimit ||
            $scope.totalFilesAdded + 1 > internals.limits.maxFileLimit) {
          console.log("overload!");
          file.newSize = (Math.ceil(file.size / internals.constants.GB_BYTES * 100) / 100).toString() + 'GB';
          $scope.overloadedList.push(file);
          $scope.showOverloadedPopup = true;
        } else {
          $scope.totalFilesAdded += 1;
          $scope.totalBytes += file.size;

          var sizeInMB = Math.floor(file.size / internals.constants.MB_BYTES);
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
            uploadLimit = data.uploadSizeLimit;

            // uploadLimit = 0;

            $scope.sessionId = data.sessionId;
            callback();
          } else {
            console.log('The server is returning an incorrect status.');
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

    /**
     * Call this when the file at (INDEX - 1) of fileList is ready 
     * to be sent to the server.
     * Note: Progress starts at 100 because the progress bar is
     * "uncovered" as progress goes on so by completion, the 
     * HTML element covering the progress bar has a width of 0.
     * 
     * @param {integer} index The index for the file in fileList AHEAD
     *                        of the one you want to upload.
     * 
     */
    $scope.start = function(index) {
      index -= 1;
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
        }).success(function (data, status, headers, config) {
            if (status === 201) {
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
              $scope.totalFailed += 1;
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
            }, false);
        });
      }
    };

    /* Call this when a files needs to be reuploaded - likely due to a failure
     * to upload the first time.
     * @param: {integer} index The index of the file in the array fileList
     */
    $scope.retry = function(index) {
      console.log('restarting!');
      $scope.fileList[index].progress = 100;
      $scope.fileList[index].uploadResult = undefined;
      $scope.totalFailed -= 1;
      $scope.start(index + 1);
    };

    /** Call this when user wants to remove file from list.
     * @param: {integer} index The index of the file in the array fileList
     */
    $scope.abort = function(index) {
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

    /** 
     * Processes the submit request from the user accordingly.
     * If the user submits with failed files, show warning first.
     * Otherwise, directly submit files to server.
     */
    $scope.submitProcessor = function () {
      if ($scope.totalFilesAdded !== $scope.totalSuccess) {
        $scope.showErrorWarningPopup = true;
      } else {
        preSubmit();
      }
    };

    /** 
     * Gets Wix session token and then runs the submit function.
     */
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

    /** 
     * Submits the user's file and form to the server.
     * If successful, the widget displays a success message and restart.
     * Otherwise, error messages are shown.
    */
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
      finalSubmission.visitorName.first = internals.escapeHtml($scope.visitorName.trim());
      finalSubmission.visitorEmail = internals.escapeHtml($scope.email.trim());
      finalSubmission.visitorMessage = internals.escapeHtml($scope.message.trim());
      console.log(finalSubmission);
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
          } else {
            console.log('The server is giving an incorrect status.');
          }
        }).error(function(data, status, headers, config) {
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

    /**
     * Call this to reset widget after widget upload fail/success.
     * All failure/success messages will disappear and variables are
     * completly reset.
     */
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
      uploadLimit = internals.limits.uploadLimit;
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

    /**
     * This setting makes a call to the backend database to get the
     * latest user settings. It's called whenever the widget is first loaded.
     * On errors, the default settings are loaded.
     */
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
              // $scope.active = false;
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
          $scope.settings = api.defaults;
      });
    };

    /** 
     * When the site owner updates the settings, this function allows the
     * widget to implement these changes immediately.
     */
    $wix.addEventListener($wix.Events.SETTINGS_UPDATED, function(message) {
      $scope.settings = message;
      console.log($scope.settings.buttonCorners);
      $scope.$apply();
    });

    $scope.getDatabaseSettings();
  });
