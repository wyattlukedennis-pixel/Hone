CREATE TABLE IF NOT EXISTS comparison_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparison_type TEXT NOT NULL,
  then_clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  now_clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  render_status TEXT NOT NULL DEFAULT 'queued',
  output_url TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (comparison_type IN ('day1_vs_latest', 'day7_vs_latest', 'day30_vs_latest')),
  CHECK (render_status IN ('queued', 'processing', 'complete', 'failed')),
  CHECK (then_clip_id <> now_clip_id)
);

CREATE INDEX IF NOT EXISTS idx_comparison_renders_journey_requested
  ON comparison_renders(journey_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_comparison_renders_user_requested
  ON comparison_renders(user_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS milestone_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_day INTEGER NOT NULL,
  render_status TEXT NOT NULL DEFAULT 'queued',
  output_url TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (milestone_day IN (7, 30, 90, 365)),
  CHECK (render_status IN ('queued', 'processing', 'complete', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_milestone_renders_journey_requested
  ON milestone_renders(journey_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_renders_user_requested
  ON milestone_renders(user_id, requested_at DESC);
