'use strict';

angular.module('sendFiles')
  .controller('VerifiedCtrl', function ($scope, $wix, Verify, $window) {
  	$scope.verify = Verify;
  	$scope.verify.loggedin = true;
  	console.log($scope.verify.loggedin);

  	$window.close();
  	console.log('verified controller loaded');
  });