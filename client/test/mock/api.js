'use strict';

angular.module('apiMock', ['ngMockE2E']).run(function ($httpBackend) {

  var settings = {};
  var settingsRE = /\/api\/settings\/([^\/]+)$/;

  $httpBackend.whenGET(settingsRE).respond(function (method, url) {
    var match = url.match(settingsRE);
    return [200, settings[match && match[1]] || {}];
  });

  $httpBackend.whenPUT(settingsRE).respond(function (method, url, json) {
    var match = url.match(settingsRE);
    var compId = match && match[1];
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
