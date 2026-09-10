-- Store one support vote per citizen and complaint.
CREATE TABLE IF NOT EXISTS complaint_upvotes (
    complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (complaint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_complaint_id
    ON complaint_upvotes (complaint_id);
