//not used currently
'use strict';

angular.module('sendFiles')
  .directive('popup', function ($wix){ 
      return function(scope, element) {
      	scope.modal = $wix.UI.create({ctrl: 'Popup', options: {modal:true, buttonSet: 'okCancel', fixed: true}});
      };
    });