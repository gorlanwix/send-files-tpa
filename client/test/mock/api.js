'use strict';

angular.module('apiMock', ['ngMockE2E']).run(function ($httpBackend) {

  var settings = {
    demo: {
      headlineText: 'Upload the file and send it to us. We will review it as soon as possible.',
      addButtonText: '+ Add Files',
      noFileText: '',
      emailAddressText: 'Your email address',
      messageText: 'You can add a message to site owner',
      submitButtonText: 'Submit'
    }
  }; //email:"jeffre@fsnlkf.com"}; - put fake settings here - also use fake compID until backend ready
  var settingsRE = /\/api\/settings\/([^\/]+)$/;

  $httpBackend.whenGET(settingsRE).respond(function (method, url) {
    var match = url.match(settingsRE);
    return [200, settings[match && match[1]] || {}];
  });

  $httpBackend.whenPUT(settingsRE).respond(function (method, url, json) {
    var match = url.match(settingsRE);
    var compId = match && match[1]; //compID = Widget ID provided by Wix
    if (compId) {
      settings[compId] = json;
      return [200, settings[compId]];
    } else {
      return [400, null];
    }
  });

  var test = $httpBackend.whenGET(/.*/);
  if (angular.isFunction(test.passThrough)) {
    test.passThrough();
  }
});
