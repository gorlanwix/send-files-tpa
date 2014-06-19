'use strict';

angular.module('sendFiles').factory('api', function ($resource, $wix) {
  var defaults = {
    headlineText: 'Upload the file and send it to us. We will review it as soon as possible.',
    addButtonText: '+ Add Files',
    yourNameText: 'Your name',
    emailAddressText: 'Your email address',
    messageText: 'You can add a message to site owner',
    submitButtonText: 'Submit',
    dividerWidth: '3',
    buttonRoundness: '5'
  };

  var headers = {
    'X-Wix-Instance': 'whatever', //$wix.Utils.getInstanceId(),
    'Content-Type': 'application/json'
  };

  // console.log(headers); //for testing

  var Settings = $resource('/api/settings/:compId', {
    compId: $wix.Utils.getOrigCompId() || $wix.Utils.getCompId() 
  }, {
    get: { method: 'GET', headers: headers },
    save: { method: 'PUT', headers: headers }
  });

  return {
    defaults: defaults,
    saveSettings: function (settings) {
      console.log('Saving');
      return Settings.save(settings);
    },
    getSettings: function (defaults) {
      var settings = {};
      var data = Settings.get();
      if (defaults === true || defaults) {
        data.$promise.then(function () {
          var settingsBackend = data.widgetSettings.settings;
          angular.forEach(defaults, function (value, key) {
            if (!settingsBackend.hasOwnProperty(key)) {
              settings[key] = value;
            } else {
              settings[key] = settingsBackend[key];
            }
          });
        });
      }
      // console.log(settings); // to print the settings out before syncing them with the widget
      return settings;
    },

    getSettings2: function (storedSettings) {
      var settings = Settings.get();
      var template = storedSettings || defaults;
      settings.$promise.then(function () {
          angular.forEach(template, function (value, key) {
            if (!settings.hasOwnProperty(key)) {
              settings[key] = value;
            }
          });
        });
      return settings;
    }

  };
});
