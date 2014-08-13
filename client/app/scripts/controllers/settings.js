'use strict';

angular.module('sendFiles')
  .controller('SettingsCtrl', function ($scope, $wix, api, $http, debounce) {

    var previousValidEmail;
    var emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
    var instance = api.getInstance();
    $scope.compId = $wix.Utils.getOrigCompId() || $wix.Utils.getCompId();
    $scope.instance = instance;

    $wix.UI.onChange('*', function (value, key) {
      if (key === 'widgetCorners' || key === 'buttonCorners' || key === 'borderWidth') { // if the settings changed is a button etc
        $scope.settings[key] = value.value;
      } else {
        $scope.settings[key] = value;
      }
  	  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
  		  $wix.Utils.getOrigCompId());
      $scope.putSettingsDebounced();
    });

    var putSettings = function () {
      // The commented out block below is for verifying the site owner's email. 
      // If you decide to not go with the Wix dashboard communication, 
      // you can uncomment it to allow for email sending through the widget.

      // Validates email. If invalid, uses last known valid email.
      // var emailToSave = $scope.userReceiveEmail;
      // console.log($scope.userReceiveEmail);
      // console.log(emailRegex.test($scope.userReceiveEmail) === false);
      // if (emailRegex.test($scope.userReceiveEmail) === false) {
      //   emailToSave = previousValidEmail;
      // }

      var combineSettings = {widgetSettings: {settings: $scope.settings}};
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
            // console.log("settings saved: " + response.data); //uncomment to check if settings are correctly saved
          });
      }

    $scope.putSettingsDebounced = debounce.debounce(putSettings, 1000, false);

    $scope.logout = function () {
      $http.get('/auth/logout/' + $scope.compId + '?instance=' + instance, {
        headers: {
          'Content-type': 'application/json',
          'X-Wix-Instance': instance
        }
      })
        .success(function(data, status, headers, config) {
          // console.log("logged out");
        }).error(function(data, status, headers, config) {
          // console.log("logged out"); // the promise returns an error, but everything works as expected.
        });

        // Reloads widget
        $wix.Settings.refreshApp();

        // Reload settings iframe
        location.reload();
    }

    var obtainSettings = function () {
      $http.get('/api/settings/' + $scope.compId + '?userProfile=true', {
            headers: {
              'Content-type': 'application/json', 
              'X-Wix-Instance': instance
            }
      }).success(function(data, status, headers, config) {
            if (status === 200) {
              if (data.widgetSettings.hasOwnProperty("settings") && data.widgetSettings.settings != null) { //checks to see if there are saved settings
                console.log('there are saved settings');
                $scope.settings = data.widgetSettings.settings; //works (this is if everything goes as planned and settings are gotten from the server)
                $wix.UI.initialize($scope.settings);
                $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                  $wix.Utils.getOrigCompId());
              } else {
                console.log('there are no saved settings');
                $scope.settings = api.defaults; // if user does not have any saved settings
                $wix.UI.initialize($scope.settings);
                $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                  $wix.Utils.getOrigCompId());
              }
            } else {
              console.log("status != 200");
              $scope.settings = api.defaults;
              console.log('Initializing Wix UI Settings Panel');
              $wix.UI.initialize($scope.settings);
              $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
                $wix.Utils.getOrigCompId());
            }
        $scope.provider = data.widgetSettings.provider;
        if ($scope.provider) {
          $scope.userName = data.widgetSettings.userProfile.displayName;
          $scope.userAccount = data.widgetSettings.userProfile.emails[0].value;
          $scope.userReceiveEmail = $scope.userAccount;
        } else {
          $scope.userReceiveEmail = null;
        }
        previousValidEmail = $scope.userReceiveEmail;
        // console.log('provider success: ' + $scope.provider + ' ' + $scope.userReceiveEmail);
        // console.log(data.widgetSettings); //uncomment to test/view settings in console
      }).error(function(data, status, headers, config) {
          // console.log("There was an error obtaining your saved settings from the database.");
          $scope.settings = api.defaults;
          $wix.UI.initialize($scope.settings);
          $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
            $wix.Utils.getOrigCompId());
          // console.log('provider error: ' + $scope.provider);
          // console.log("There was an error obtaining your account settings."); //uncomment to test there are errors getting settings.
      });
    }

    obtainSettings();

    $scope.tryValidate = function () {
      var emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){1}$/;
      console.log(emailRegex.test($scope.userReceiveEmail));
    }

    $wix.Settings.refreshApp();

    var popup = Wix.UI.create({ctrl: 'Popup',
                        options: {buttonSet: 'okCancel', fixed:true}});

    $('#popupAnchorBtn').on('click', function(evt){
      evt.stopPropagation();
      popup.getCtrl().open();
    });
});
