-- Add a stable row id while retaining the existing one-vote-per-user constraint.
ALTER TABLE complaint_upvotes
  ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_complaint_upvotes_id
  ON complaint_upvotes (id);
