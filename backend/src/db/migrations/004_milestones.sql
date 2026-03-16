ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS milestone_length_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS milestone_started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS milestone_chapter INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS milestone_start_day INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journeys_milestone_length_days_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_milestone_length_days_check
      CHECK (milestone_length_days IN (7, 14, 30, 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journeys_milestone_chapter_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_milestone_chapter_check
      CHECK (milestone_chapter >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journeys_milestone_start_day_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_milestone_start_day_check
      CHECK (milestone_start_day >= 1);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS journey_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  milestone_length_days INTEGER NOT NULL,
  start_day_index INTEGER NOT NULL,
  end_day_index INTEGER NOT NULL,
  recorded_days INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (chapter_number >= 1),
  CHECK (milestone_length_days IN (7, 14, 30, 100)),
  CHECK (start_day_index >= 1),
  CHECK (end_day_index >= start_day_index),
  CHECK (recorded_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_journey_reveals_journey ON journey_reveals(journey_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_reveals_user ON journey_reveals(user_id, completed_at DESC);
