'use strict';

angular.module('sendFiles')
  .controller('StorageCtrl', function ($scope, api, $wix, $location) {
  	$scope.compId = api.getCompId() || api.getOrigCompId();;
  	$scope.instance = api.getInstance();

  	// $controller('SettingsCtrl', {$scope: $scope});

  });