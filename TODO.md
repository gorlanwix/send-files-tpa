# TODO

## Server (Andrey):
- no cross domain api requests?
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


## Settings Pannel (Gorlan):
- allow site owner to choose upload file size limit (an essay grader doesn't need 1 GB file limits)
- change debounce to 20 seconds when ready for deployment
- add scrollglue
