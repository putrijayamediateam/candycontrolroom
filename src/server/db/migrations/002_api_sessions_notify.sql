-- Milestone 1b: authenticated API + live event stream
-- Session ids are SHA-256 hashes of the cookie token; the raw token never touches the database.
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;

-- Every committed event is announced to the API's live stream (delivered on COMMIT only,
-- so rolled-back work never reaches the office view).
CREATE OR REPLACE FUNCTION events_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('candy_events', NEW.seq::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER events_notify_insert AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION events_notify();
