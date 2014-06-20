'use strict';

angular.module('sendFiles')
  .controller('SettingsCtrl', function ($scope, $wix, api, $http) {
    $scope.emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
    $scope.loggedin = false;
    $scope.userEmail = 'test@testing.com'; //for testing

    $wix.UI.onChange('*', function (value, key) {
      $scope.settings[key] = value;
  	  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
  		$wix.Utils.getOrigCompId());
      //then save here with debounce
      putSettings();
    });

    var putSettings = function () {
      var combineSettings = {widgetSettings: {userEmail: $scope.userEmail, settings: $scope.settings}};
      var settingsJson = JSON.stringify(combineSettings);
      var compId = '12345'; // $wix.Utils.getOrigCompId()
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

    var compId = '12345'

    $http.get('/api/settings/' + compId, {
            headers: {
              'Content-type': 'application/json', 
              'X-Wix-Instance': 'whatever' //$wix.Utils.getInstanceId()
            }
    }).success(function(data, status, headers, config) {
          if (status === 200) {
            if (Object.keys(data.widgetSettings.settings).length != 0) { //checks to see if there are saved settings
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
    }).error(function(data, status, headers, config) {
        console.log("There was an error obtaining your saved settings from the database.");
        $scope.settings = api.getSettings(api.defaults);
        $scope.settings.$promise.then(function () {
          $wix.UI.initialize($scope.settings);
          $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
          $wix.Utils.getOrigCompId());
        });
    });
    
    // $scope.settings.$promise.then(function () {
    //   console.log('Initializing Wix UI Settings Panel');
    //   $wix.UI.initialize($scope.settings);
    //   $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
    //   $wix.Utils.getOrigCompId());
    // });
});
