'use strict';

var mocha = require('mocha');
var expect = require('chai').expect;
var request = require('supertest');
var app = require('../../app');

describe('App', function () {

  it('should say hello', function (done) {
    request(app).get('/')
      .expect(200)
      .expect('Hello, World!', done);
  });

});
