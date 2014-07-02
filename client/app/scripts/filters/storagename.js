'use strict'

angular.module('sendFiles').filter('storageName', function () {
	return function (input) {
		if (input) {
			var displayName = input;
			if (input === 'google') {
				displayName += " Drive";
			}
			console.log(displayName);
			return displayName[0].toUpperCase() + displayName.slice(1)
		}
	}
})