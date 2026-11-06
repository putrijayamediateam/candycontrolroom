-- Head chat (CANDY) + one sub-chat per staff member, and the decisions log.
-- messages.staff_id is the thread: 'candy' is the head chat; every other staff id is that person's sub-chat.
ALTER TABLE messages ADD COLUMN kind text NOT NULL DEFAULT 'message'
  CHECK (kind IN ('message', 'order', 'relay', 'reply', 'note'));
ALTER TABLE messages ADD COLUMN reply_to uuid REFERENCES messages(id);
-- An order AIN gives CANDY to pass on to a staff member.
ALTER TABLE messages ADD COLUMN route_to text REFERENCES staff(id);
-- Only AIN's messages have a delivery state: waiting -> picked_up -> answered.
ALTER TABLE messages ADD COLUMN delivery text CHECK (delivery IN ('waiting', 'picked_up', 'answered'));
ALTER TABLE messages ADD COLUMN read_by_owner_at timestamptz;
ALTER TABLE messages ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX messages_thread_idx ON messages (staff_id, created_at);
CREATE INDEX messages_waiting_idx ON messages (delivery) WHERE delivery IN ('waiting', 'picked_up');

CREATE TABLE decisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decided_on  date NOT NULL,
  body        text NOT NULL,
  source      text,                                  -- e.g. 'docs/DECISIONS.md', 'head chat'
  message_id  uuid REFERENCES messages(id),
  recorded_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON decisions (decided_on DESC, created_at DESC);
