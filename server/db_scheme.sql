CREATE TABLE widget (
    widget_id bigserial PRIMARY KEY,
    instance_id text NOT NULL,
    component_id text NOT NULL,
    created timestamp NOT NULL
)

CREATE TABLE oauth_token (
    token_id bigserial PRIMARY KEY,
    widget_id integer REFERENCES widget ON DELETE CASCADE,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_type text NOT NULL,
    expires timestamp NOT NULL,
    created timestamp NOT NULL
)


INSERT INTO widget (instance_id, component_id, created) VALUES ($1, $2, NOW()) RETURNING widget_id

INSERT INTO oauth_token (widget_id, access_token, refresh_token, token_type, expires, created) VALUES ($1, $2, $3, $4, $5, NOW())

SELECT access_token, refresh_token, expires
FROM widget, oauth_token
WHERE widget.widget_id = oauth_token.widget_id AND instance_id = $1 AND component_id = $2 LIMIT 1

UPDATE oauth_token
SET access_token = 'test'
FROM widget
WHERE widget.widget_id = oauth_token.widget_id AND instance_id = 'whatever' AND component_id = 'whatever'
