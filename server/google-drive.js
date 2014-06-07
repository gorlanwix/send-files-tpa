'use strict';

var fs = require('fs');

function insertFile(client, oauth2Client, title, mimeType, tmpPath, callback) {
    client.drive.files.insert({ title: title, mimeType: mimeType, parents: ['Send Files - Wix App']})
        .withMedia(mimeType, fs.readFileSync(tmpPath))
        .withAuthClient(oauth2Client)
        .execute(function(err, result) {
            if(err)
                console.error('Inserting to Drive error:', err);
            callback(result);
        });
}

module.exports = {
  insertFile: insertFile
};
