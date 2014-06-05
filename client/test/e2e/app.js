'use strict';

describe('Widget', function () {

  beforeEach(function () {
    browser().navigateTo('/index.html');
  });

  it('tells its name', function () {
    expect(element('h1').text()).toBe('Send Files App');
  });

});
