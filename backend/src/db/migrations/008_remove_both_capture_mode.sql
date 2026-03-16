UPDATE journeys
SET capture_mode = 'video'
WHERE capture_mode = 'both';

ALTER TABLE journeys
  DROP CONSTRAINT IF EXISTS journeys_capture_mode_check;

ALTER TABLE journeys
  ADD CONSTRAINT journeys_capture_mode_check
  CHECK (capture_mode IN ('video', 'photo'));

ALTER TABLE journeys
  DROP CONSTRAINT IF EXISTS journeys_both_mode_rule_check;

ALTER TABLE journeys
  DROP COLUMN IF EXISTS both_mode_rule;

