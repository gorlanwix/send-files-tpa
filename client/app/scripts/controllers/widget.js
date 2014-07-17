'use strict';

angular.module('sendFiles')
  .controller('WidgetCtrl', function ($scope, api, internals, $wix, $upload, $http, $location, $timeout) {

    /**
     * Upper limit on total size of files that can be uploaded.
     * @type {Number}
     */
    var uploadLimit = internals.limits.uploadLimit;

    /**
     * Total size of all uploaded files so far in Bytes.
     * @type {Number}
     */
    var totalBytes = 0;

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
    var instance = api.getInstance();

    /**
     * Represents the Component ID of this widget.
     * @type {String}
     */
    var compId = api.getOrigCompId() || api.getCompId();

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
    var sessionId = '';

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
    var upload = [];

    /**
     * A list used to tell what files have been successfully uploaded. It is 
     * sent to the backend for verification when the user hits submit. The
     * objects in the array are file IDs given by the backend when
     * the upload has been completed successfully.
     * @type {Array of Numbers}
     */
    var uploadedFiles = [];

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
    var uploadRetryList = [];

    /**
     * A list of indices representing files that have failed to upload
     * even after 5 additional retry attempts.
     * @type {Array of Numbers}
     */
    $scope.failedAfterRetryList = [];

    /**
     * A list of indices representing files waiting to be shown to the user
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
                           fileIds: uploadedFiles,
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
     * Otherwise, it validates the input based on whether or not it fits the
     * regex.
     * This is used in place of ng-pattern in order to properly set validity
     * when there is no input. Otherwise, the floating label does not reappear
     * when the user types something and then subsequently removes their input.
     * @param  {String} newValue Value in input
     */
    $scope.updateEmail = function (newValue) {
      var EMAIL_REGEX = internals.constants.EMAIL_REGEX;
      if (newValue === undefined) {
        $scope.fileForm.email.$setPristine();
      } else if (EMAIL_REGEX.test(newValue)) {
        $scope.fileForm.email.$setValidity('validEmail', true);
      } else {
        $scope.fileForm.email.$setValidity('validEmail', false);
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
     * @return {Object} The resulting style
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
        } else if (index === ($scope.fileList.length - 1)) {
          return {'background-color': '#93C993'};
        } else {
          return {'background-color': '#93C993', 'border-bottom': 0};
        }
      } else if ($scope.fileList[index].uploadResult === false) {
        if (index === 0) {
          return {'border-top': 0, 'background-color': '#FF9999', 'border-bottom': 0};
        } else if (index === ($scope.fileList.length - 1)) {
          return {'background-color': '#FF9999'};
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
        $timeout(function() {
          $scope.overloadedList = [];
        }, 1000);
      } else if (situation.type === 'failed upload') {
        if (situation.reply === 'yes') {
          $scope.failedAfterRetryList.processing = true;
          $scope.showFailedUploadPopup = false;
          $timeout(function() {
            while ($scope.failedAfterRetryList.length > 0) {
              var indexValue = $scope.failedAfterRetryList.splice(0, 1);
              $scope.retry(indexValue[0]);
            }
          }, 1000);
        } else {
          $scope.showFailedUploadPopup = false;
          $scope.failedAfterRetryList = [];
        }
      } else if (situation.type === 'error warning') {
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

    /**
     * Returns whether or not if the user has done everything needed to submit.
     * Makes the submit button clickable and removes all error messages.
     * @return {boolean} Whether or not the user is ready to submit
     */
    $scope.submitReady = function() {
      if ($scope.active && $scope.fileForm.$valid  &&
            (($scope.totalSuccess + $scope.totalFailed ) ===
            $scope.totalFilesAdded) && $scope.totalSuccess) {
        return true;
      } else {
        return false;
      }
    };

    /**
     * Call this  when users select file(s) to begin file upload.
     * Gets the session ID and verifies capacity with server before
     * file processing actually happens.
     * @param {Array of Files} $files A list of files the user is uploading
     */
    $scope.onFileSelect = function($files) {
      if ($scope.active && !$scope.submitting &&
          !$scope.submitSuccessful && !$scope.submitFailed) {
        if (firstTimeUploading) {
          firstTimeUploading = false;
          verifySpace(function() {
            processFiles($files);
            for (var i = 0; i < fileUploadQueue.length; i++) {
              processFiles(fileUploadQueue[i]);
            }
          }, $files);
        } else if (sessionId) {
          processFiles($files);
        } else {
          fileUploadQueue.push($files);
        }
      }
    };

    /**
     * Processes each file to verify that uploading it will not violate
     * the capacity limit or the maximum file total limit. Once that it is
     * confirmed, the function calls the upload function on each file.
     * @param {Array of Files} $files A list of files to be processed
     */
    var processFiles = function($files) {
      for (var i = 0; i < $files.length; i++) {
        var file = $files[i];
        if (totalBytes + file.size > uploadLimit ||
            $scope.totalFilesAdded + 1 > internals.limits.maxFileLimit) {
          file.newSize = (Math.ceil(file.size / internals.constants.GB_BYTES * 100) / 100).toString() + 'GB';
          $scope.overloadedList.push(file);
          $scope.showOverloadedPopup = true;
        } else {
          $scope.totalFilesAdded += 1;
          totalBytes += file.size;

          var sizeInMB = Math.floor(file.size / internals.constants.MB_BYTES);
          if (sizeInMB === 0) {
            file.newSize = ' 1MB';
          } else {
            file.newSize = sizeInMB.toString() + 'MB';
          }

          $scope.fileList.push(file);
          $scope.fileList[fileIndex].progress = 100;
          fileIndex += 1;
          start(fileIndex);
        }
      }
    };

    /**
     * Sends a request to the server to check if the user's Google Drive
     * has enough storage space. Also receives session ID from server.
     * @param  {Function} callback Calls this function after verification to 
     *                             start the uploading the first files and
     *                             those waiting in the queue
     */
    var verifySpace = function(callback) {
      var verifyURL = '/api/files/session/' + compId;
      $http({method: 'GET',
             url: verifyURL,
             headers: {'X-Wix-Instance' : instance},
             timeout: 10000
        }).success(function (data, status) {
          if (status === 200) {
            uploadLimit = data.uploadSizeLimit;
            sessionId = data.sessionId;
            callback();
          } else {
            if (internals.debug) {
              console.log('The server is returning an incorrect status.');
            }
          }
        }).error(function (data, status) {
          if (internals.debug) {
            console.log('Could not get sessionID');
          }
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
     * to be sent to the server. Files that fail to upload are automatically
     * retried up to 5 times before an error message is shown to the user.
     * Note: We are using (index - 1) because it is too slow to increment
     * the fileIndex after the asynchronous call.
     * Note: Progress starts at 100 because the progress bar is
     * "uncovered" as progress goes on so by completion, the 
     * HTML element covering the progress bar has a width of 0.
     * @param {integer} index The index for the file in fileList AHEAD
     *                        of the one you want to upload.
     * 
     */
    var start = function(index) {
      index -= 1;
      if (upload[index] !== 'aborted') {
        var uploadURL = '/api/files/upload/' + compId + '?sessionId=' + sessionId;
        upload[index] = $upload.upload({
          url: uploadURL,
          method: 'POST',
          headers: {'X-Wix-Instance' : instance},
          file: $scope.fileList[index]
        }).progress(function(evt) {
          $scope.fileList[index].progress = (100 - Math.min(95, parseInt(95.0 * evt.loaded / evt.total, 10)));
        }).success(function (data, status) {
            if (status === 201) {
              if (uploadedFiles[index] !== 'aborted') {
                $scope.fileList[index].retryMessage = undefined;
                if ($scope.failedAfterRetryList.length === 0) {
                  $scope.failedAfterRetryList.processing = false;
                  if (retryQueue.length > 0) {
                    for (var i = 0; i < retryQueue.length; i++) {
                      $scope.failedAfterRetryList[i] = retryQueue[i];
                    }
                    retryQueue = [];
                    $scope.showFailedUploadPopup = true;
                  }
                }
                uploadedFiles.push(data.fileId);
                $scope.fileList[index].progress = 0;
                $scope.fileList[index].uploadResult = true;
                $scope.totalSuccess += 1;
              }
            } else {
              if (internals.debug) {
                console.log('The server is returning an incorrect status.');
              }
            }
          }).error(function() {
            if ($scope.failedAfterRetryList.length === 0) {
              $scope.failedAfterRetryList.processing = false;
              if (retryQueue.length > 0) {
                for (var i = 0; i < retryQueue.length; i++) {
                  $scope.failedAfterRetryList[i] = retryQueue[i];
                }
                retryQueue = [];
                $scope.showFailedUploadPopup = true;
              }
            }
            if (uploadedFiles[index] !== 'aborted') {
              $scope.fileList[index].uploadResult = false;
              $scope.totalFailed += 1;
              var arrayPosition = uploadRetryList.map(
                function(elem) {
                  return elem.fileLocation;
                }).indexOf(index);
              if (arrayPosition < 0) {
                $scope.fileList[index].retryMessage = 'Failed: Auto-retrying - ';
                uploadRetryList.push(
                  {fileLocation: index,
                   numberOfTries: 1});
                $scope.retry(index);
              } else {
                if (uploadRetryList[arrayPosition].numberOfTries < 5) {
                  uploadRetryList[arrayPosition].numberOfTries += 1;
                  $scope.retry(index);
                } else {
                  $scope.fileList[index].retryMessage = 'Failed: click to retry - ';
                  uploadRetryList.splice(arrayPosition, 1);
                  if (!$scope.failedAfterRetryList.processing) {
                    $scope.failedAfterRetryList.push(index);
                    $scope.showFailedUploadPopup = true;
                  } else {
                    retryQueue.push(index);
                  }
                }
              }
            }
          }).xhr(function(xhr) {
            xhr.upload.addEventListener('abort', function() {
              if (internals.debug) {
                console.log('abort complete');
              }
            }, false);
          });
      }
    };

    /**
     * Call this when a files needs to be reuploaded - likely due to a failure
     * to upload the first time.
     * @param: {integer} index The index of the file in the array fileList
     */
    $scope.retry = function(index) {
      $scope.fileList[index].progress = 100;
      $scope.fileList[index].uploadResult = undefined;
      $scope.totalFailed -= 1;
      start(index + 1);
    };

    /** 
     * Call this when user wants to remove a file from list.
     * @param: {integer} index The index of the file to be removed
     *                         in the array fileList
     */
    $scope.abort = function(index) {
      $scope.fileList[index].aborted = true;
      uploadedFiles[index] = 'aborted';
      $scope.totalFilesAdded -= 1;
      if ($scope.fileList[index].uploadResult === false) {
        $scope.totalFailed -= 1;
      }
      if ($scope.fileList[index].uploadResult === true) {
        $scope.totalSuccess -= 1;
      }
      if (upload[index] !== undefined) {
        upload[index].abort();
      }
      upload[index] = 'aborted';
      totalBytes -= $scope.fileList[index].size;
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
        $wix.Activities.getUserSessionToken(
            function OnSuccess(userToken) {
              finalSubmission.wixSessionToken = userToken;

              finalSubmission.wixSessionToken = 'diamond'; //FOR TESTING. REMOVE THIS

              submit();
            });
      }
    };

    /** 
     * Submits the user's file and form to the server.
     * If successful, the widget displays a success message and restart.
     * Otherwise, error messages are shown.
    */
    var submit = function () {
      var uploadedFileTemp = [];
      var j = 0;
      for (var i = 0; i < uploadedFiles.length; i++) {
        if (uploadedFiles[i] !== 'aborted') {
          uploadedFileTemp[j] = uploadedFiles[i];
          j += 1;
        }
      }
      finalSubmission.fileIds = uploadedFileTemp;
      finalSubmission.visitorName.first = internals.escapeHtml($scope.visitorName.trim());
      finalSubmission.visitorEmail = internals.escapeHtml($scope.email.trim());
      finalSubmission.visitorMessage = internals.escapeHtml($scope.message.trim());
      var uploadURL = '/api/files/commit/' + compId + '?sessionId=' + sessionId;
      $http({method: 'POST',
             url: uploadURL,
             headers: {'X-Wix-Instance' : instance},
             data: finalSubmission,
             timeout: 10000
      }).success(function(data, status) {
          if (status === 202) {
            $scope.submitting = false;
            $scope.submitSuccessful = true;
            $timeout(function() {
              $scope.reset();
            }, 2000);
          } else {
            if (internals.debug) {
              console.log('The server is giving an incorrect status.');
            }
          }
        }).error(function(data, status) {
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
     * All failure/success messages and user inputs/file uploads
     * will disappear and variables are completly reset.
     */
    $scope.reset = function() {
      $scope.fileForm.visitorName.$setPristine();
      $scope.fileForm.email.$setPristine();
      $scope.fileForm.message.$setPristine();
      
      $scope.submitting = false;
      $scope.submitFailed = false;
      $scope.submitSuccessful = false;
      
      $scope.visitorName = '';
      $scope.email = '';
      $scope.message = '';

      firstTimeUploading = true;

      fileIndex = 0;
      uploadLimit = internals.limits.uploadLimit;
      totalBytes = 0;
      $scope.totalFilesAdded = 0;
      
      $scope.fileList = [];
      $scope.overloadedList = [];
      uploadRetryList = [];

      upload = [];
      uploadedFiles = [];
      uploadRetryList = [];
      fileUploadQueue = [];

      $timeout(function() {
        $scope.totalSuccess = 0;
      }, 1000);

      $scope.totalFailed = 0;
    };

    /**
     * This setting makes a call to the backend database to get the
     * latest user settings. It's called whenever the widget is first loaded.
     * On errors, the default settings are loaded.
     */
    var getDatabaseSettings = function() {
      var urlDatabase = '/api/settings/' + compId;
      $http({method: 'GET',
             url: urlDatabase,
             headers: {'X-Wix-Instance' : instance},
             timeout: 10000
      }).success(function (data, status) {
          if (status === 200) {
            if (!data.widgetSettings.provider ||
                !data.widgetSettings.userEmail) {
              // $scope.active = false;
            }
            if (data.widgetSettings.settings !== null &&
                Object.getOwnPropertyNames(data.widgetSettings.settings).length !== 0) {
              $scope.settings = data.widgetSettings.settings;
            } else {
              $scope.settings = api.defaults;
            }
          } else {
            if (internals.debug) {
              console.log('The server is returning an incorrect status.');
            }
            $scope.settings = api.defaults;
          }
        }).error(function () {
          $scope.settings = api.defaults;
        });
    };

    /** 
     * When the site owner updates the settings, this added event listener
     * allows the widget to implement these changes immediately.
     */
    $wix.addEventListener($wix.Events.SETTINGS_UPDATED, function(message) {
      $scope.settings = message;
      $scope.$apply();
    });

    getDatabaseSettings();
  });
