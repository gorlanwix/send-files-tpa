CREATE TABLE oauth_token (
    instance_id text NOT NULL,
    component_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_type text NOT NULL,
    expires timestamp NOT NULL,
    auth_provider text NOT NULL,
    created timestamp NOT NULL,
    PRIMARY KEY (instance_id, component_id)
)

CREATE TABLE widget_settings (
    instance_id text NOT NULL,
    component_id text NOT NULL,
    settings text,
    user_email text,
    curr_provider text,
    updated timestamp NOT NULL,
    created timestamp NOT NULL,
    PRIMARY KEY (instance_id, component_id)
)

INSERT INTO oauth_token (instance_id, component_id, access_token, refresh_token, token_type, expires, auth_provider, created) \
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())

SELECT access_token, refresh_token, expires, auth_provider \
FROM oauth_token \
WHERE instance_id = $1 \
AND component_id = $2 \
AND auth_provider = $3 \
LIMIT 1

UPDATE oauth_token \
SET access_token =  $1, expires = $2 \
WHERE instance_id = $2 \
AND component_id = $3 \
AND auth_provider = $4 \
RETURNING *


INSERT INTO widget_settings (instance_id, component_id, user_email, updated, created) \
VALUES ($1, $2, $3, NOW(), NOW())

INSERT INTO widget_settings (instance_id, component_id, settings, user_email, updated, created) \
VALUES ($1, $2, $3, $4, NOW(), NOW())

UPDATE widget_settings \
SET user_email =  $1 \
WHERE instance_id = $2 \
AND component_id = $3 \
RETURNING *

UPDATE widget_settings \
SET user_email =  $1, settings = $2 \
WHERE instance_id = $3 \
AND component_id = $4 \
RETURNING *

SELECT l.settings, l.user_email, r.auth_provider \
FROM widget_settings AS l \
FULL JOIN oauth_token AS r \
ON r.instance_id = $1 \
AND r.component_id = $2 \
AND l.instance_id = r.instance_id \
AND l.component_id = r.component_id \
LIMIT 1

-- SELECT *
-- FROM widget_settings AS l
-- FULL JOIN oauth_token AS r
-- ON l.instance_id = 'hatever'
-- AND l.component_id = 'however'
-- AND r.instance_id = 'hatever'
-- AND r.component_id = 'however'
-- AND l.instance_id = r.instance_id
-- AND l.component_id = r.component_id
-- LIMIT 1
-- ;


DELETE FROM oauth_token \
WHERE instance_id = $1 \
AND component_id = $2 \
AND auth_provider = $3 \
RETURNING *

