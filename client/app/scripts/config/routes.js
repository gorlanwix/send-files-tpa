'use strict';

angular.module('sendFiles')
	.config(function ($routeProvider) {
		$routeProvider
			.when('/settings', {
				templateUrl: '/views/settings.html',
				controller: 'SettingsCtrl'
			}
			.when('/storage/:compId/:instance', {
				templateUrl: '/views/storage.html',
				controller: 'StorageCtrl'
			})
			.when('/verified', {
				templateUrl: '/views/verified.html'
			})
			.otherwise({
				template: 'The page does not exist.'
			})
	});