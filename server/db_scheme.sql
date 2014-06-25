CREATE TABLE oauth_token (
    instance_id text NOT NULL,
    component_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_type text,
    expires timestamp NOT NULL,
    provider text NOT NULL,
    created timestamp NOT NULL,
    PRIMARY KEY (instance_id, component_id)
)

CREATE TABLE widget_settings (
    instance_id text NOT NULL,
    component_id text NOT NULL,
    settings json DEFAULT '{}',
    service_settings json DEFAULT '{}',
    user_email text DEFAULT '' NOT NULL,
    curr_provider text,
    updated timestamp NOT NULL,
    created timestamp NOT NULL,
    PRIMARY KEY (instance_id, component_id)
)

CREATE TABLE session (
    session_id bigserial PRIMARY KEY,
    instance_id text NOT NULL,
    component_id text NOT NULL,
    closed boolean NOT NULL DEFAULT false,
    created timestamp NOT NULL
)

CREATE TABLE file (
    file_id bigserial PRIMARY KEY,
    session_id bigint REFERENCES session ON DELETE RESTRICT,
    temp_name text NOT NULL,
    original_name text NOT NULL,
    size bigint NOT NULL,
    created timestamp NOT NULL
)

CREATE TABLE upload_failure (
    file_id bigint PRIMARY KEY REFERENCES file ON DELETE CASCADE,
    resolved boolean NOT NULL DEFAULT false
)


SELECT s.instance_id, s.component_id, file.file_id, file.temp_name, file.original_name, w.curr_provider, w.service_settings, w.user_email
FROM session AS s, file, widget_settings AS w, upload_failure AS fail
WHERE fail.resolved = $1
AND file.file_id = fail.file_id
AND file.created > $2
AND s.session_id = file.session_id
AND w.instance_id = s.instance_id
AND w.component_id = s.component_id

INSERT INTO file (session_id, temp_name, original_name, created) \
VALUES ($1, $2, $3, NOW())


UPDATE file
SET upload_ready = true
FROM
(
  VALUES
  ($2),
  ($3),
  ...
) AS ready(id)
WHERE file_id = ready.id
AND sessionId = $1

INSERT INTO session (instance_id, component_id, last_access, created) \
VALUES ($1, $2, NOW(), NOW())

UPDATE session \
SET last_access = NOW() \
WHERE session_id = $1 \
AND component_id = $2 \
AND instance_id = $3

SELECT \
exists(SELECT 1 \
    FROM session \
    WHERE session_id = $1 \
    AND component_id = $2 \
    AND instance_id = $3)

DELETE FROM session \
WHERE session_id = $1 \
AND component_id = $2 \
AND instance_id = $3


INSERT INTO oauth_token (instance_id, component_id, access_token, refresh_token, token_type, expires, provider, created) \
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())

SELECT access_token, refresh_token, expires, provider \
FROM oauth_token \
WHERE instance_id = $1 \
AND component_id = $2 \
AND provider = $3 \
LIMIT 1

UPDATE oauth_token \
SET access_token =  $1, expires = $2 \
WHERE instance_id = $2 \
AND component_id = $3 \
AND provider = $4 \
RETURNING *


INSERT INTO widget_settings (instance_id, component_id, settings, user_email, curr_provider, updated, created) \
VALUES ($1, $2, $3, $4, $5, NOW(), NOW())


UPDATE widget_settings \
SET user_email = COALESCE($1, user_email), \
    settings = COALESCE($2, settings), \
    curr_provider = COALESCE($3, curr_provider) \
WHERE instance_id = $4 \
AND component_id = $5 \
RETURNING *

UPDATE widget_settings \
SET curr_provider = '' \
WHERE instance_id = $1 \
AND component_id = $2 \
RETURNING *

SELECT settings, user_email, curr_provider \
FROM widget_settings \
WHERE instance_id = $1 \
AND component_id = $2 \

UPDATE widget_settings
SET settings = COALESCE(null, settings),
   user_email = COALESCE(null, user_email),
   curr_provider = COALESCE('', curr_provider),
   updated = NOW()
WHERE instance_id = 'whatever'
AND component_id = 'however'

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
AND provider = $3 \
RETURNING *


SELECT *, SUM(size) AS total_size
OVER (PARTITION BY session_id)
FROM file
WHERE file_id IN (30, 31)
AND session_id = 116
