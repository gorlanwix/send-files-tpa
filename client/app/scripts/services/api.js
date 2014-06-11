'use strict';

angular.module('sendFiles').factory('api', function ($resource, $wix) {
  var defaults = {
    headlineText: 'Upload the file and send it to us. We will review it as soon as possible.',
    addButtonText: '+ Add Files',
    noFileText: '',
    emailAddressText: 'Your email address',
    messageText: 'You can add a message to site owner',
    submitButtonText: 'Submit'
  };

  var headers = {
    'X-Wix-Instance': $wix.Utils.getInstanceId()
  };

  var Settings = $resource('/api/settings/:compId', {
    compId: $wix.Utils.getOrigCompId() || $wix.Utils.getCompId()
  }, {
    get: { method: 'GET', headers: headers },
    save: { method: 'PUT', headers: headers }
  });

  return {
    defaults: defaults,
    saveSettings: function (settings) {
      return Settings.save(settings);
    },
    getSettings: function (defaults) {
      var settings = Settings.get();
      if (defaults === true || defaults) {
        settings.$promise.then(function () {
          angular.forEach(defaults, function (value, key) {
            if (!settings.hasOwnProperty(key)) {
              settings[key] = value;
            }
          });
        });
      }
      return settings;
    }
  };
});
