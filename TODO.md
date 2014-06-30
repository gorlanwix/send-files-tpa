TODO
====

Server (Andrey):
----------------
- return actual classes and not database rows
- comments and better organization
- send actual instance (not instanceId) as a state parameter on service auth
- dropbox support error handling
- disconnect user if token was revoked
- handle revoked token case when still have new access token (important for upload retry's)?
- handle zipping failures independently
- heroku deployment
- scheduled temporary files clean up, upload session closing
- restore failed uploads every 10 minutes with task scheduler
- relic
- more tests

### NOTES:

google needs offline mode to use refresh tokens
dropbox's access token is persistent, no need for refresh token or expiration
box has a refresh token by default, looks just like google's

advisory locks for file clean up?


Settings Pannel (Gorlan):
-------------------------
- allow site owner to choose upload file size limit (an essay grader doesn't need 1 GB file limits)
- error with emailToSave when not logged in //might be server problem
- userEmail gone
- replaced with userProfile {}
- instance={{instance}}&userProfile=true
- currently sending an object to widget. try to make it just the value

