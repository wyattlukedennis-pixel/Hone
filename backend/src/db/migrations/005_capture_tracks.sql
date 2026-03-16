ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS capture_mode TEXT NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journeys_capture_mode_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_capture_mode_check
      CHECK (capture_mode IN ('video', 'photo', 'both'));
  END IF;
END $$;

ALTER TABLE clip_uploads
  ADD COLUMN IF NOT EXISTS capture_type TEXT NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clip_uploads_capture_type_check'
  ) THEN
    ALTER TABLE clip_uploads
      ADD CONSTRAINT clip_uploads_capture_type_check
      CHECK (capture_type IN ('video', 'photo'));
  END IF;
END $$;

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS capture_type TEXT NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clips_capture_type_check'
  ) THEN
    ALTER TABLE clips
      ADD CONSTRAINT clips_capture_type_check
      CHECK (capture_type IN ('video', 'photo'));
  END IF;
END $$;

ALTER TABLE clips
  DROP CONSTRAINT IF EXISTS clips_journey_id_recorded_on_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clips_unique_capture_day
  ON clips(journey_id, recorded_on, capture_type);

CREATE INDEX IF NOT EXISTS idx_clips_journey_capture_recorded_at
  ON clips(journey_id, capture_type, recorded_at DESC);
