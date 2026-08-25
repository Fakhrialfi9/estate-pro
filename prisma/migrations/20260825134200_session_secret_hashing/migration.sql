-- Session identifiers were historically stored as bearer values. Hash any
-- pre-existing values once so the database no longer retains raw session secrets.
UPDATE `authentication_user_sessions`
SET `session_id` = SHA2(`session_id`, 256)
WHERE CHAR_LENGTH(`session_id`) <> 64
   OR `session_id` NOT REGEXP '^[0-9a-fA-F]{64}$';
