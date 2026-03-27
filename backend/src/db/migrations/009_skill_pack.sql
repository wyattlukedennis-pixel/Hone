ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS skill_pack TEXT NOT NULL DEFAULT 'fitness';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journeys_skill_pack_check'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_skill_pack_check
      CHECK (skill_pack IN ('fitness', 'drawing', 'instrument'));
  END IF;
END $$;

