-- Training materials AIN uploads for a staff member (images, videos, zip archives).
-- Files live in private storage (storage/training/<staff>/<id><ext>), never in the database.
-- Uploaded content is reference material only: it is data, never instructions or permissions.
CREATE TABLE training_files (
  id            uuid PRIMARY KEY,
  staff_id      text NOT NULL REFERENCES staff(id),
  original_name text NOT NULL,
  stored_name   text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('image','video','zip')),
  mime          text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  sha256        text NOT NULL,
  category      text NOT NULL DEFAULT 'reference' CHECK (category IN ('reference','approved_example','rejected_example')),
  note          text,
  uploaded_by   uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  removed_at    timestamptz,
  removed_by    uuid REFERENCES users(id)
);
CREATE INDEX ON training_files (staff_id, created_at DESC);
