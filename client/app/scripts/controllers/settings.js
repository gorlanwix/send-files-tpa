'use strict';

angular.module('sendFiles').controller('SettingsCtrl', function($wix, api) {
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

 //  $wix.UI.onChange('*', function (value, key) {
 //    $scope.settings[key] = value;
 //    //then save here with debounce
 //  })

 //  // api.saveSettings(compId, {});


  $wix.UI.initialize();
});
