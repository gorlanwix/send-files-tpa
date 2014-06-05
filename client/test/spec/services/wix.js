'use strict';

describe('$wix', function () {

  var $window;
  var $log;
  var $wix;

  beforeEach(module('sendFiles', function ($provide) {
    $log = jasmine.createSpyObj('$log', ['error']);
    $provide.value('$log', $log);
  }));

  describe('with $window.Wix', function () {
    beforeEach(module(function ($provide) {
      $window = { Wix: 'Wix' };
      $provide.value('$window', $window);
    }));

    beforeEach(inject(function (_$wix_) {
      $wix = _$wix_;
    }));

    it('does not call $log.error', function () {
      expect($log.error).not.toHaveBeenCalled();
    });

    it('returns $window.Wix', function () {
      expect($wix).toBe($window.Wix);
    });
  });

  describe('without $window.Wix', function () {
    beforeEach(module(function ($provide) {
      $window = {};
      $provide.value('$window', $window);
    }));

    beforeEach(inject(function (_$wix_) {
      $wix = _$wix_;
    }));

    it('does not call $log.error', function () {
      expect($log.error).toHaveBeenCalled();
    });

    it('returns $window.Wix', function () {
      expect($wix).toBeUndefined();
    });
  });

});
