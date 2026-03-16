ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS both_mode_rule TEXT NOT NULL DEFAULT 'either';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journeys_both_mode_rule_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_both_mode_rule_check
      CHECK (both_mode_rule IN ('either', 'both_required'));
  END IF;
END $$;

