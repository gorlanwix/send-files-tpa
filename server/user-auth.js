'use strict';

var https = require('https');

var hostServer = 'open.ge.tt';

function authenticate(apikey, email, password, callback) {
  var data = JSON.stringify({
    apikey: apikey,
    email: email,
    password: password
  });

  var options = {
    host: hostServer,
    path: '/1/users/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  var req = https.request(options, function (res) {
    res.setEncoding('utf8');
    var recieved = '';
    res.on('data', function (chunk) {
      console.log("chunk: " + chunk);
      recieved += chunk;
    });

    res.on('end', function () {
      console.log("body: " + recieved);
      callback(recieved);
    })
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  console.log("sent data :" + data);
  req.write(data);
  req.end();
}

module.exports = authenticate;
