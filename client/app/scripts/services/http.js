'use strict';

angular.module('sendFiles').factory('http', function ($scope, $wix, $http) {

	var obtainSettings = function () {
      $http.get('/api/settings/' + $scope.compId, {
            headers: {
              'Content-type': 'application/json', 
              'X-Wix-Instance': 'whatever' //$wix.Utils.getInstanceId()
            }
      }).success(function(data, status, headers, config) {
        console.log(data.widgetSettings.settings == null);
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
        $scope.userEmail = data.widgetSettings.userEmail;
        console.log('provider success: ' + $scope.provider + ' ' + data.widgetSettings.userEmail);
      }).error(function(data, status, headers, config) {
          console.log("There was an error obtaining your saved settings from the database.");
          $scope.settings = api.getSettings(api.defaults);
          $scope.settings.$promise.then(function () {
            $wix.UI.initialize($scope.settings);
            $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
            $wix.Utils.getOrigCompId());
          });
          $scope.provider = false;
          console.log('provider error: ' + $scope.provider);
          alert("There was an error obtaining your account settings.");
      });
    }

    $scope.logout = function () {
      $http.get('/api/auth/logout/' + $scope.compId)
        .success(function(data, status, headers, config) {
          // console.log("logged out");
        }).error(function(data, status, headers, config) {
          // console.log("error logging out");
        });

        $wix.Settings.refreshSettings(); // need this to be refreshSettings
    }

    var putSettings = function () {
      var combineSettings = {widgetSettings: {userEmail: $scope.userEmail, settings: $scope.settings}};
      var settingsJson = JSON.stringify(combineSettings);
      var compId = $wix.Utils.getOrigCompId();
      $http.put('/api/settings/' + compId, 
         settingsJson,  { headers: {
                      'X-Wix-Instance': 'whatever', //$wix.Utils.getInstanceId(),
                      'Content-Type': 'application/json'
                      }
                    })
          .success(function (data, status, headers, config) {
          })
          .error(function (data, status, headers, config) {
            console.log("There was an error saving settings.");
          })
          .then(function (response) {
            console.log(response.data);
          });
      }
});

