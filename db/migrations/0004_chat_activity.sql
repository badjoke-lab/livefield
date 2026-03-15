ALTER TABLE minute_snapshots ADD COLUMN comment_count INTEGER;
ALTER TABLE minute_snapshots ADD COLUMN delta_comments INTEGER;
ALTER TABLE minute_snapshots ADD COLUMN comments_per_min REAL;
ALTER TABLE minute_snapshots ADD COLUMN agitation_raw REAL;
ALTER TABLE minute_snapshots ADD COLUMN agitation_level INTEGER;

ALTER TABLE collector_status ADD COLUMN chat_state TEXT;
ALTER TABLE collector_status ADD COLUMN chat_unavailable_reason TEXT;
