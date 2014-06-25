TODO:

- handle zipping failures independently
- restore failed uploads every 10 minutes with task scheduler
- handle revoked token case when still have new access token (important for upload retry's)?
- dropbox support
- comments and better organization
- heroku deployment
- scheduled temporary files clean up
- relic
- email templates
- more tests

- allow site owner to choose upload file size limit (an essay grader doesn't need 1 GB file limits)
- add new page to call "refreshApp()" when pop up window closes
- add debounce to save settings

NOTES:

google needs offline mode to use refresh tokens
dropbox's access token is persistent, no need for refresh token or expiration
box has a refresh token by default, looks just like google's

clean up temporary files every 24 hour regradles whether they are marked for deletion or not.
adv:
    no need for ready to delete column
dis:
    what if they are not uploaded within 24 hours?
        should be error then.
        
advisory locks for file clean up?
