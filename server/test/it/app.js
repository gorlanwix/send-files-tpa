'use strict';

var mocha = require('mocha');
var expect = require('chai').expect;
var request = require('supertest');
var app = require('../../app');
var googleDrive = require('../../controllers/google-drive.js');
var userAuth = require('../../controllers/user-auth.js');
var pg = require('pg');
var connectionString = process.env.DATABASE_URL || require('../../connect-keys/pg-connect.json').connectPg;

var instanceId = 'whatever';
var compId = '12345'

describe('requests', function () {
  it('should be not found', function (done) {
    request(app).get('/adsfasdfa')
      .expect('Content-Type', /json/)
      .expect(404, done);
  });
});

describe('api requests', function () {


  describe('widget IDs', function () {
    it('should give invalid instance error', function (done) {
      request(app).get('/api/settings/' + compId)
        .set('x-wix-instance', 'trololo')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('error').to.equal('invalid instance');
          expect(res.body).to.have.property('status').to.equal(401);
          done();
        });
    });


    it('should give "not found" error when component ID is empty', function (done) {
      request(app).get('/api/settings/')
        .set('x-wix-instance', instanceId)
        .expect('Content-Type', /json/)
        .expect(404)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('error').to.equal('resource not found');
          expect(res.body).to.have.property('status').to.equal(404);
          done();
        });
    });
  });


  describe('widget settings', function () {

    after(function (doneAfter) {
      pg.connect(connectionString, function (err, client, done) {
        var deleteSettings = 'DELETE FROM widget_settings WHERE instance_id = $1 AND component_id = $2';
        var values = [instanceId, compId];
        client.query(deleteSettings, values, function (err) {
          done();
          pg.end();
          doneAfter();
        });
      });
    });

    it('should get empty settings', function (done) {
      request(app).get('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('widgetSettings');
          expect(res.body).to.have.property('status').to.equal(200);
          expect(res.body.widgetSettings).to.have.property('userEmail').to.equal('');
          expect(res.body.widgetSettings).to.have.property('provider').to.equal('');
          expect(res.body.widgetSettings).to.have.property('settings').to.be.an('object');
          done();
        });
    });


    it('should give invalid request format error', function (done) {
      request(app).put('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .send({widgetSettings: 'test'})
        .expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(400);
          expect(res.body).to.have.property('error').to.equal('invalid request format');
          done();
        });
    });

    it('should give invalid request format error b/c of email', function (done) {
      request(app).put('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .send({widgetSettings: {userEmail: 'test'}})
        .expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(400);
          expect(res.body).to.have.property('error').to.equal('invalid request format');
          done();
        });
    });

    it('should give invalid request format error b/c of settings', function (done) {
      request(app).put('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .send({widgetSettings: {userEmail: '', settings: 'test'}})
        .expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(400);
          expect(res.body).to.have.property('error').to.equal('invalid request format');
          done();
        });
    });

    it('should update with empty email', function (done) {
      request(app).put('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .send({widgetSettings: {userEmail: '', settings: {hello: 'hi'}}})
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(201);
          done();
        });
    });

    it('should update settings', function (done) {
      request(app).put('/api/settings/' + compId)
        .set('x-wix-instance', instanceId)
        .send({widgetSettings: {userEmail: 'timoha@vdv.com', settings: {hello: 'sup'}}})
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(201);
          done();
        });
    });

  });

  describe('files upload session', function () {
    this.timeout(10000);
    it('should get capacity and sessionId', function (done) {
      request(app).get('/api/files/session/' + compId)
        .set('x-wix-instance', instanceId)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(200);
          expect(res.body).to.have.property('sessionId').to.exist;
          expect(res.body).to.have.property('capacity').to.exist;
          done();
        });
    });
  });

  describe('files upload', function () {
    var fileIds = [];
    var sessionId;

    before(function (beforeDone) {
      request(app).get('/api/files/session/' + compId)
        .set('x-wix-instance', instanceId)
        .end(function (err, res){
          console.log(res.body);
          if (err) return done(err);
          sessionId = res.body.sessionId;
          console.log('sessionId: ', sessionId);
          beforeDone();
        });
    });

    // after(function (doneAfter) {
    //   pg.connect(connectionString, function (err, client, done) {
    //     var deleteSession = 'DELETE FROM session WHERE instance_id = $1 AND component_id = $2'
    //     var deleteSettings = 'DELETE FROM widget_settings WHERE instance_id = $1 AND component_id = $2';
    //     var values = [instanceId, compId];
    //     client.query(deleteSession, values, function (err) {
    //       client.query(deleteSettings, values, function (err) {
    //         done();
    //         pg.end();
    //         doneAfter();
    //       });
    //     });
    //   });
    // });

    it('should error asking for sessionId', function (done) {
      request(app).post('/api/files/upload/' + compId)
        .set('x-wix-instance', instanceId)
        .attach('sendFile', 'test/test.jpg')
        .expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res){
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(400);
          expect(res.body).to.have.property('error').to.equal('invalid session format');
          done();
        });
    });

    it('should upload first file and return fileId', function (done) {
      request(app).post('/api/files/upload/' + compId + '?sessionId=' + sessionId)
        .set('x-wix-instance', instanceId)
        .attach('sendFile', 'test/test.jpg')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res){
          console.log(res.body);
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(200);
          expect(res.body).to.have.property('fileId').to.exist;
          fileIds.push(res.body.fileId);
          done();
        });
    });

    it('should upload second file and return fileId', function (done) {
      request(app).post('/api/files/upload/' + compId + '?sessionId=' + sessionId)
        .set('x-wix-instance', instanceId)
        .attach('sendFile', 'test/test.jpg')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res){
          console.log(res.body);
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(200);
          expect(res.body).to.have.property('fileId').to.exist;
          fileIds.push(res.body.fileId);
          done();
        });
    });

    it('should upload zipped files to Google', function (done) {
      this.timeout(10000);
      var resJson = {
        visitorEmail: "timoha@bugaga.com",
        visitorName: "Andrey Elenskiy",
        message: "You better fucking work",
        fileIds: fileIds
      }

      request(app).post('/api/files/send/' + compId + '?sessionId=' + sessionId)
        .set('x-wix-instance', instanceId)
        .send(resJson)
        .expect('Content-Type', /json/)
        .expect(202)
        .end(function (err, res){
          console.log(res.body);
          if (err) return done(err);
          expect(res.body).to.have.property('status').to.equal(202);
          done();
        });
    });
  });

});


describe('Google Drive', function () {
  var accessToken;
  this.timeout(10000);

  before(function (done) {
    var widgetIds = {
      instanceId: instanceId,
      compId: compId
    };
    pg.connect(connectionString, function (err, client, doneBefore) {
      userAuth.getInstanceTokens(client, widgetIds, function (err, tokens) {
        if (err) {
          console.error('token retrieval error: ', err);
        }
        accessToken = tokens.access_token;
        done();
        pg.end();
        doneBefore();
      });
    });
  });

  it('should get available capacity from Google', function (done) {
    googleDrive.getAvailableCapacity(accessToken, function (err, capacity) {
      if (err) {
        console.log('capacity error: ', err);
      }
      console.log('capacity: ', capacity);
      expect(capacity).to.be.a('number');
      done();
    });
  });
});






