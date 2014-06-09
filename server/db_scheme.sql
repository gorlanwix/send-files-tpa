CREATE TABLE widget (
    widget_id bigserial PRIMARY KEY,
    instance_id text NOT NULL,
    component_id text NOT NULL,
    created timestamp NOT NULL
)

CREATE TABLE oauth_token (
    token_id bigserial PRIMARY KEY,
    widget_id bigint REFERENCES widget ON DELETE CASCADE,
    id_token text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_type text NOT NULL,
    expires timestamp NOT NULL,
    created timestamp NOT NULL
)

CREATE TABLE widget_settings (
    setting_id bigserial PRIMARY KEY,
    widget_id bigint REFERENCES widget ON DELETE CASCADE,
    settings text,
    user_email text,
    updated timestamp NOT NULL,
    created timestamp NOT NULL
)


INSERT INTO widget (instance_id, component_id, created) VALUES ($1, $2, NOW())
RETURNING widget_id

INSERT INTO oauth_token (widget_id, id_token, access_token, refresh_token, token_type, expires, created)
VALUES ($1, $2, $3, $4, $5, $6 NOW())

SELECT access_token, refresh_token, expires
FROM widget, oauth_token
WHERE widget.widget_id = oauth_token.widget_id AND instance_id = $1 AND component_id = $2 LIMIT 1

UPDATE oauth_token, id_token \
SET access_token =  $1, id_token = $2, refresh_token = $3 \ \
FROM widget \
WHERE widget.widget_id = oauth_token.widget_id \
AND instance_id = $4 \
AND component_id = $5 \
RETURNING access_token, refresh_token, id_token, expires


INSERT INTO widget_settings (widget_id, user_email, updated, created)
VALUES ($1, $2, NOW(), NOW())


DELETE FROM oauth_token \
USING widget \
WHERE widget.widget_id = oauth_token.widget_id \
AND instance_id = $1 \
AND component_id = $2 \
RETURNING *


SELECT widget_id \
FROM widget \
WHERE instance_id = $1 AND component_id = $2 LIMIT 1




