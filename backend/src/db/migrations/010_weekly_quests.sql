CREATE TABLE IF NOT EXISTS journey_weekly_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reward_xp >= 0),
  CHECK (week_key ~ '^\\d{4}-\\d{2}-\\d{2}:\\d{4}-\\d{2}-\\d{2}$'),
  UNIQUE (journey_id, week_key, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_journey_weekly_quests_journey ON journey_weekly_quests(journey_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_weekly_quests_user ON journey_weekly_quests(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_weekly_quests_week ON journey_weekly_quests(week_key);
