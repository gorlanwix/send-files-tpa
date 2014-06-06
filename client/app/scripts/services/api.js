'use strict';

angular.module('sendFiles').factory('api', function ($http) {
  return {
    saveSettings: function (compId, settings) {
      return $http.put('/api/settings/:compId', settings, { params: {
        compId: compId
      }});
    },
    getSettings: function (compId) {
      return $http.get('/api/settings/:compId', { params: {
        compId: compId
      }});
    }
  };
});
