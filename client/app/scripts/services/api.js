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

  var getInstance = function() {
    var url = $location.absUrl();
    var instanceRegexp = /.*instance=([\[\]a-zA-Z0-9\.\-_]*?)(&|$|#).*/g;
    var instance = instanceRegexp.exec(url);
    if (instance && instance[1]) {
      var instanceId = instance[1]; //instanceId is actually the unparsed instance
    } else {
      console.log('All hell has broken loose.');
      //BREAK STUFF! THIS SHOULD NEVER HAPPEN.
      var instanceId;
    }
    return instanceId; //returns the unparsed instance
  }

  var headers = {
    'X-Wix-Instance': getInstance(),
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
    },

    getInstance: getInstance

  };
});
