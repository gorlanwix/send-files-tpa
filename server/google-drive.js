'use strict';

var oauth2Client = require('./user-auth.js').oauth2Client;
var googleapis = require('googleapis');


// Retrieve tokens via token exchange explaind above.
// Or you can set them.
oauth2Client.credentials = {
  access_token: 'ya29.KgCczNJAV9oNWh8AAAD-_Op1DqdPOfPX6oQ5WoBQJ3lFvh9kWVGzJK4TK6Aw3A',
};


function insertFile(title, mimeType, callback) {
    googleapis
        .discover('drive', 'v1')
        .execute(function(err, client) {
            client.drive.files.insert({ title: title, mimeType: mimeType })
                //.withMedia(mimeType, )
                .withAuthClient(oauth2Client)
                .execute(function(err, result) {
                    console.log('error:', err);
                    callback(result);
                });
        });
}

module.exports = {
  insertFile: insertFile
};
