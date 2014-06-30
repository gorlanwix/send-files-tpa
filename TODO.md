# TODO

## Server (Andrey):
- comments and better organization
- send actual instance (not instanceId) as a state parameter on service auth
- dropbox support error handling
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
- add new page to call "refreshApp()" when pop up window closes
- add debounce to save settings
- name placeholder
- order content settings
- message "placeholder"
- split headline into title (body L) and description (body M)
- customize text placeholder background
- border transparency
- background/box transparency
- head/description color/font
- form background / form text
- disconnect link
- accordion to put site owner email (last one: configuration settings)
- {{compId}}?instance=12345 for login and logout
- connect settings to widget
- userEmail object compatible with wix-model?


