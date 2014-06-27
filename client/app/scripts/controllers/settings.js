'use strict';

angular.module('sendFiles')
  .controller('SettingsCtrl', function ($scope, $wix, api, $http, Verify, debounce) {
    $scope.verify = Verify;
    $scope.verify.loggedin = false; //for testing right now
    var previousValidEmail;

    $wix.UI.onChange('*', function (value, key) {
      $scope.settings[key] = value;
  	  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
  		$wix.Utils.getOrigCompId());
      //then save here with debounce
      // putSettings();
      $scope.putSettingsDebounced();
    });

    var emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
    var instance = api.getInstance();
    $scope.compId = $wix.Utils.getOrigCompId() || $wix.Utils.getCompId();
    $scope.instance = instance;

    var putSettings = function () {
      // Validates email. If invalid, uses last known valid email.
      var emailToSave = $scope.userReceiveEmail;
      if (emailRegex.test($scope.userReceiveEmail) === false) {
        emailToSave = previousValidEmail;
      }

      var combineSettings = {widgetSettings: {userEmail: emailToSave, settings: $scope.settings}};
      var settingsJson = JSON.stringify(combineSettings);
      var compId = $wix.Utils.getOrigCompId();
      $http.put('/api/settings/' + compId + '?instance=' + instance, 
         settingsJson,  { headers: {
                      'X-Wix-Instance': instance,
                      'Content-Type': 'application/json'
                      }
                    })
          .success(function (data, status, headers, config) {
          })
          .error(function (data, status, headers, config) {
            console.log("There was an error saving settings.");
          })
          .then(function (response) {
            console.log("settings saved: " + response.data);
          });
        console.log(emailToSave);
      }

    $scope.putSettingsDebounced = debounce.debounce(putSettings, 20000, false);

    $scope.logout = function () {
      $http.get('/auth/logout/' + $scope.compId + '?instance=' + instance)
        .success(function(data, status, headers, config) {
          // console.log("logged out");
        }).error(function(data, status, headers, config) {
          // console.log("error logging out");
        });

        $wix.Settings.refreshApp();
        location.reload();
    }

    var obtainSettings = function () {
      $http.get('/api/settings/' + $scope.compId, {
            headers: {
              'Content-type': 'application/json', 
              'X-Wix-Instance': instance
            }
      }).success(function(data, status, headers, config) {
            if (status === 200) {
              if (data.widgetSettings.hasOwnProperty("settings") && data.widgetSettings.settings != null) { //checks to see if there are saved settings
              // if (Object.keys(data.widgetSettings.settings)) { 
                console.log('there are saved settings');
                $scope.settings = data.widgetSettings.settings; //works (this is if everything goes as planned and settings are gotten from the server)
                $wix.UI.initialize($scope.settings);
                $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                $wix.Utils.getOrigCompId());
              } else {
                console.log('there are no saved settings');
                $scope.settings = api.getSettings(api.defaults); // if user does not have any saved settings
                $scope.settings.$promise.then(function () {
                  $wix.UI.initialize($scope.settings);
                  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                  $wix.Utils.getOrigCompId());
                });
              }
            } else {
              console.log("status != 200");
              $scope.settings = api.getSettings(api.defaults);
              $scope.settings.$promise.then(function () {
                console.log('Initializing Wix UI Settings Panel');
                $wix.UI.initialize($scope.settings);
                $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                $wix.Utils.getOrigCompId());
              });
            }
        $scope.provider = data.widgetSettings.provider;
        $scope.userReceiveEmail = data.widgetSettings.userEmail;
        previousValidEmail = $scope.userReceiveEmail;
        console.log('provider success: ' + $scope.provider + ' ' + data.widgetSettings.userEmail);
      }).error(function(data, status, headers, config) {
          console.log("There was an error obtaining your saved settings from the database.");
          $scope.settings = api.getSettings(api.defaults);
          $scope.settings.$promise.then(function () {
            $wix.UI.initialize($scope.settings);
            $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
            $wix.Utils.getOrigCompId());
          });
          console.log('provider error: ' + $scope.provider);
          // alert("There was an error obtaining your account settings.");
      });
    }

    obtainSettings();

    $scope.tryValidate = function () {
      var emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
      console.log(emailRegex.test($scope.userReceiveEmail));
    }

    // $scope.updateEmail = function (newValue) {
    //   finalSubmission.visitorEmail = newValue;
    // };
    
    // $scope.settings.$promise.then(function () {
    //   console.log('Initializing Wix UI Settings Panel');
    //   $wix.UI.initialize($scope.settings);
    //   $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
    //   $wix.Utils.getOrigCompId());
    // });
    $wix.Settings.refreshApp();
});
