CREATE TABLE IF NOT EXISTS clip_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clip_uploads_user_status ON clip_uploads(user_id, upload_status, created_at DESC);

CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  recorded_on DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (journey_id, recorded_on)
);

CREATE INDEX IF NOT EXISTS idx_clips_journey_recorded_at ON clips(journey_id, recorded_at DESC);
