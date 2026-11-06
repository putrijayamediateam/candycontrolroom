-- CANDY CONTROL ROOM — initial schema
-- All timestamps are timestamptz (UTC stored). Business dates use Asia/Kuala_Lumpur.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Human users (AIN, clinical reviewers). AI personas are NOT users.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('owner','clinical_reviewer','reviewer')),
  password_hash text NOT NULL,
  interface_locale text NOT NULL DEFAULT 'en' CHECK (interface_locale IN ('en','ms')),
  content_locale   text NOT NULL DEFAULT 'en' CHECK (content_locale IN ('en','ms')),
  onboarding_done  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- AI staff personas (21 by default)
CREATE TABLE staff (
  id            text PRIMARY KEY,               -- slug e.g. 'candy', 'adam'
  display_name  text NOT NULL,
  role_title    text NOT NULL,
  department    text NOT NULL,
  reports_to    text REFERENCES staff(id),
  avatar        jsonb NOT NULL DEFAULT '{}',     -- editable appearance brief
  colour        text NOT NULL,
  deliverables  text[] NOT NULL DEFAULT '{}',
  allowed_actions    text[] NOT NULL DEFAULT '{}',
  prohibited_actions text[] NOT NULL DEFAULT '{}',
  onboarding    text NOT NULL DEFAULT 'not_briefed'
                CHECK (onboarding IN ('not_briefed','learning','ready','needs_clarification')),
  status        text NOT NULL DEFAULT 'idle',
  paused        boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Versioned instructions per staff member (append-only)
CREATE TABLE staff_instructions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    text NOT NULL REFERENCES staff(id),
  version     int NOT NULL,
  body        text NOT NULL,
  approved_examples jsonb NOT NULL DEFAULT '[]',
  rejected_examples jsonb NOT NULL DEFAULT '[]',
  author_user uuid REFERENCES users(id),
  change_note text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, version)
);

-- Proposed memory/instruction updates awaiting AIN
CREATE TABLE memory_proposals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   text NOT NULL REFERENCES staff(id),
  proposal   text NOT NULL,
  scope      text NOT NULL DEFAULT 'role' CHECK (scope IN ('role','shared')),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  decided_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE campaigns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  objective  text,
  starts_on  date,
  ends_on    date,
  content_locale text CHECK (content_locale IN ('en','ms')),  -- NULL = inherit
  is_demo    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref          text NOT NULL UNIQUE,            -- TSK-YYYYMMDD-NNN
  kind         text NOT NULL CHECK (kind IN ('content','design_dev')),
  template     text NOT NULL,
  title        text NOT NULL,
  objective    text,
  campaign_id  uuid REFERENCES campaigns(id),
  owner_staff  text REFERENCES staff(id),
  collaborators text[] NOT NULL DEFAULT '{}',
  platforms    text[] NOT NULL DEFAULT '{}',
  audience     text,
  content_locale text CHECK (content_locale IN ('en','ms')),  -- NULL = inherit
  deadline     timestamptz,
  priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  publish_slot timestamptz,
  stage        text NOT NULL,
  side_state   text,                            -- needs_information, blocked, ...
  blocker      text,
  next_action  text,
  requires_clinical boolean NOT NULL DEFAULT false,
  requires_consent  boolean NOT NULL DEFAULT false,
  is_demo      boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_dependencies (
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on),
  CHECK (task_id <> depends_on)
);

-- Deliverable versions. content_hash binds approvals to exact content.
CREATE TABLE deliverable_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version      int NOT NULL,
  platform     text,                            -- NULL = master
  copy_text    text,
  asset_keys   text[] NOT NULL DEFAULT '{}',
  destination  text,                            -- account/page id
  content_locale text NOT NULL DEFAULT 'en' CHECK (content_locale IN ('en','ms')),
  translated_from uuid REFERENCES deliverable_versions(id),
  content_hash text NOT NULL,
  submitted_by text REFERENCES staff(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, platform, version)
);

-- QA / clinical / consent evidence
CREATE TABLE checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  uuid NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  check_type  text NOT NULL,                    -- spelling, brand_name, clinical_signoff, consent, sources ...
  result      text NOT NULL CHECK (result IN ('passed','failed','not_verified')),
  evidence    text,
  actor_kind  text NOT NULL CHECK (actor_kind IN ('staff','human')),
  actor_id    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Daily review requests (CPR / DPR) with server-issued IDs
CREATE TABLE pr_counters (
  prefix   text NOT NULL,
  day      date NOT NULL,
  last_no  int NOT NULL,
  PRIMARY KEY (prefix, day)
);

CREATE TABLE review_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref          text NOT NULL UNIQUE,            -- CPR-YYYYMMDD-001 / DPR-...
  kind         text NOT NULL CHECK (kind IN ('CPR','DPR')),
  my_date      date NOT NULL,                   -- Malaysia business date
  task_id      uuid NOT NULL REFERENCES tasks(id),
  version_id   uuid NOT NULL REFERENCES deliverable_versions(id),
  submitted_by text NOT NULL REFERENCES staff(id),
  summary      text,
  candy_review text,
  candy_reviewed_at timestamptz,
  status       text NOT NULL DEFAULT 'awaiting_candy'
               CHECK (status IN ('awaiting_candy','awaiting_ain','approved','changes_requested','rejected','superseded')),
  repo_pr_url  text,                            -- only real, verified links
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON review_requests (my_date, kind);

-- Delegation sessions (BECOME ME)
CREATE TABLE delegation_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_by    uuid NOT NULL REFERENCES users(id),
  scope         jsonb NOT NULL,
  policy_version text NOT NULL,
  include_pending boolean NOT NULL DEFAULT false,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_reason text,                          -- 'im_done' | 'stop' | 'expired'
  briefing_acknowledged_at timestamptz,
  CHECK (expires_at > starts_at)
);
-- At most one non-revoked session
CREATE UNIQUE INDEX one_open_delegation ON delegation_sessions ((true)) WHERE revoked_at IS NULL;

-- Approvals: tied to exact version + action
CREATE TABLE approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    uuid NOT NULL REFERENCES deliverable_versions(id),
  content_hash  text NOT NULL,
  action        text NOT NULL CHECK (action IN ('internal_approval','schedule','publish','reply','design_approval','implement','release')),
  decision      text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  decided_by_kind text NOT NULL CHECK (decided_by_kind IN ('human','candy_delegated')),
  decided_by_user uuid REFERENCES users(id),   -- AIN or the delegating user
  delegation_id uuid REFERENCES delegation_sessions(id),
  reason        text,
  invalidated_at timestamptz,
  invalidated_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (decided_by_kind = 'human' OR delegation_id IS NOT NULL)
);

-- Platform posts (one row per destination)
CREATE TABLE platform_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid NOT NULL REFERENCES tasks(id),
  version_id     uuid NOT NULL REFERENCES deliverable_versions(id),
  platform       text NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','threads','gbp','youtube')),
  format         text NOT NULL,                 -- feed_image, reel, story, carousel, text ...
  is_story       boolean NOT NULL DEFAULT false,
  slot_at        timestamptz NOT NULL,
  my_date        date NOT NULL,
  status         text NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','scheduled','publishing','published','failed','unknown','manual_pending','cancelled')),
  idempotency_key text NOT NULL UNIQUE,
  provider_post_id text,
  provider_confirmed_at timestamptz,
  is_demo        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_targets (
  platform    text PRIMARY KEY,
  feed_target int NOT NULL DEFAULT 3,
  story_target int NOT NULL DEFAULT 0,
  stories_count_toward_feed boolean NOT NULL DEFAULT false,
  slots       text[] NOT NULL DEFAULT '{12:00,13:00,17:00,20:00}'
);

-- Staff questions to AIN
CREATE TABLE questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid REFERENCES tasks(id),
  staff_id    text NOT NULL REFERENCES staff(id),
  question    text NOT NULL,
  why_it_matters text NOT NULL,
  recommended_assumption text,
  answer      text,
  answered_by uuid REFERENCES users(id),
  resume_stage text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid REFERENCES tasks(id),
  staff_id   text REFERENCES staff(id),
  author_kind text NOT NULL CHECK (author_kind IN ('human','staff','system')),
  author_id  text NOT NULL,
  locale     text NOT NULL DEFAULT 'en',
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE connections (
  id          text PRIMARY KEY,                 -- e.g. 'anthropic', 'meta', 'tiktok'
  status      text NOT NULL DEFAULT 'not_connected'
              CHECK (status IN ('not_connected','connected','error','expired','skipped')),
  capabilities jsonb NOT NULL DEFAULT '{}',
  secret_ciphertext bytea,
  last_check_at timestamptz,
  last_error  text
);

CREATE TABLE tool_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid REFERENCES tasks(id),
  staff_id    text NOT NULL REFERENCES staff(id),
  tool        text NOT NULL,
  evidence    text NOT NULL CHECK (evidence IN ('verified','user_reported','suggested','demo')),
  status      text NOT NULL CHECK (status IN ('queued','running','succeeded','failed','blocked','cancelled')),
  step        text,
  blocker     text,
  heartbeat_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Append-only audit / workflow event log (also drives the 3D office)
CREATE TABLE events (
  seq         bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_kind  text NOT NULL CHECK (actor_kind IN ('human','staff','candy_delegated','system')),
  actor_id    text NOT NULL,
  on_behalf_of uuid REFERENCES users(id),
  type        text NOT NULL,
  task_id     uuid,
  target      text,
  version_id  uuid,
  prev_state  text,
  new_state   text,
  reason      text,
  data        jsonb NOT NULL DEFAULT '{}',
  is_demo     boolean NOT NULL DEFAULT false
);
CREATE INDEX ON events (task_id);
CREATE INDEX ON events (type, at);

CREATE OR REPLACE FUNCTION events_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'events table is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER events_no_update BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();

CREATE TABLE app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
