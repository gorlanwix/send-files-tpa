'use strict';

angular.module('sendFiles')
  .controller('SettingsCtrl', function ($scope, $wix, api) {
   //  var compId = 'abc';//temporary fake ID we can use while backend is broken 
   //  //how to actually get widget compID//var compId = $wix.Utils.getOrigCompId(); 
   //  //Original because more IDs are generated as settings are updated
   //  var p = api.getSettings(compId);
  	// //p is a promise made by http
   //  $scope.settings = {}; //beginning with no settings

   //  p.success(function (settings) {
   //    $scope.settings = settings;
   //    $wix.UI.initialize(settings);
   //  }); //if promise successful, update and initialize with settings

   //  p.error(function () {
   //    console.log("Settings failed");
   //    $wix.UI.initialize();
   //  });

   //  // $scope.$watch('settings.email', 
   //  // ng-show="settings.email" - do this in html to check if user actually gave email
    $wix.UI.onChange('*', function (value, key) {
      $scope.settings[key] = value;
      // $scope.settings.$promise.then(function () {
  	  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
  		$wix.Utils.getOrigCompId());
      // });
      //then save here with debounce
      var compId = $wix.Utils.getOrigCompId();
      // api.saveSettings(compId, {});
      api.saveSettings(compId, $scope.settings);
    });

    var compId = $wix.Utils.getOrigCompId();
    api.saveSettings(compId, {});

    $scope.settings = api.getSettings();


    // uncomment the block below when app is ready to be connected to a backend database
    // actually might be unnecessary. code in api.js seems to already do that
    // $http({ method: 'GET',
    //         URL: '/api/settings/' + compId,
    //         headers: api.headers
    // }).success(function(data, status, headers, config) {
    //       if (status === 200) {
    //         $scope.settings = data.widgetSettings.settings;
    //       } else {
    //         console.log("You successfully obtained data from the server, but the status is not 200. Not sure why this error is showing up. It should never display.");
    //         $scope.settings = data.widgetSettings.settings;
    //       }
    // }).error(function(data, status, headers, config) {
    //       console.log("There was an error obtaining your saved settings from the database.");
    // });

    $scope.settings.$promise.then(function () {
      $wix.UI.initialize($scope.settings);
    });


    // $scope.settings.$promise.then(function () {
  	 //  $wix.Settings.triggerSettingsUpdatedEvent($scope.settings, 
  	 //  	$wix.Utils.getOrigCompId());
    // });

});
