# Hone Product Requirements Document (PRD)

## 1. Product Summary

Hone is a mobile app that helps people stay motivated while learning a skill by recording short daily practice videos and turning them into visible progress over time.

Core value proposition:

- Capture practice in 5-10 seconds per day.
- Automatically organize progress into a chronological journey.
- Make improvement obvious with side-by-side comparisons and milestone montage videos.

Product tagline:

> Sharpen your skills. One day at a time.

## 2. Goals and Non-Goals

### Goals (MVP)

- Help users consistently record daily practice clips.
- Show clear visual evidence of progress.
- Reinforce habit formation through streaks, reminders, and milestone moments.
- Enable easy sharing/export of progress videos.

### Non-Goals (MVP)

- Social feed/community interactions.
- In-app messaging or coaching.
- Advanced AI critique/scoring of technique quality.
- Monetization features (subscriptions/paywall).

## 3. Target Users

- Musicians (piano, guitar, singing).
- Artists (drawing, painting, calligraphy).
- Athletes (skateboarding, dance, gymnastics).
- Language learners (pronunciation/speaking).
- Creators (acting, storytelling, writing progress).

## 4. Jobs to Be Done

- "Help me stick with daily practice."
- "Show me proof I’m improving."
- "Let me look back and compare where I started to where I am now."
- "Give me something shareable that celebrates progress."

## 5. MVP Scope

1. Account creation and sign-in.
2. Create and manage multiple skill journeys.
3. Daily short clip capture/upload for each journey.
4. Chronological timeline per journey.
5. Auto comparison: Day 1 vs Today, 7 days ago vs Today, 30 days ago vs Today (when available).
6. Auto milestone montage generation at Day 7/30/90/365.
7. Streak tracking and daily reminder notifications.
8. Export/share comparison and milestone videos.

## 6. Core User Flows

### Flow A: Start a Journey

1. User opens app first time.
2. User signs up/signs in.
3. User creates journey (name + optional category/icon).
4. User lands on journey home with "Record Today" CTA.

### Flow B: Daily Recording

1. User taps "Record Today."
2. Camera opens with 5-10s guidance.
3. User records and previews clip.
4. User taps Save.
5. Clip appears in timeline with date label and streak updates.

### Flow C: See Progress

1. User opens journey.
2. User views timeline and streak.
3. User taps "Compare."
4. App renders side-by-side (or split-screen) comparison and playback controls.

### Flow D: Milestone + Sharing

1. User reaches milestone day.
2. App generates montage in background.
3. User receives in-app card/push notification.
4. User previews montage and taps Export/Share.

## 7. Functional Requirements

### 7.1 Authentication

- Email + password and Apple/Google sign-in (at least one social provider + email).
- Session persistence across app restarts.
- Logout support.

### 7.2 Journey Management

- Create journey with required `title`.
- Optional journey metadata: `category`, `color_theme`, `goal_text`.
- Edit journey title/metadata.
- Archive journey (soft delete).
- User can maintain multiple active journeys.

### 7.3 Video Capture and Storage

- Capture target duration: 5-10 seconds.
- Allow re-record before save.
- Store original clip + compressed derivative for timeline playback.
- Attach clip to specific journey and date.
- One default clip per journey per day (MVP rule). Optional override: replace existing clip.

### 7.4 Timeline

- Show clips ordered newest-first with day labels.
- Show day number relative to first clip (Day 1, Day 2, etc.).
- Tap clip to playback full screen.

### 7.5 Comparisons

- Predefined comparisons:
  - Day 1 vs Latest
  - 7 days ago vs Latest (if enough clips)
  - 30 days ago vs Latest (if enough clips)
- Display both clip dates clearly.
- Allow export/share of rendered comparison.

### 7.6 Milestone Montage

- Triggered at day counts: 7, 30, 90, 365.
- Select representative clip samples from timeline.
- Auto-render short montage (target 10-30 seconds).
- Notify user when render completes.

### 7.7 Habit Reinforcement

- Daily reminder notifications (user-configurable time).
- Practice streak:
  - Increment when daily clip recorded.
  - Reset after missed day (optional grace day is v2).
- Milestone celebration cards.

### 7.8 Export and Share

- Export rendered video to local device media library.
- Open native share sheet.
- Format targets: vertical 9:16 optimized output + fallback source aspect handling.

## 8. Non-Functional Requirements

- App launch time under 3 seconds on mid-tier devices.
- Clip upload success rate >= 98%.
- Render job reliability >= 99% with retry.
- Timeline playback start < 1 second for recent clips.
- Secure media access via signed URLs.
- Data privacy and deletion support (account delete removes user media and metadata).

## 9. UX and Design Requirements

- Recording flow must be completable in under 10 seconds from app open.
- Primary CTA always visible on journey home (`Record Today`).
- Progress-focused language over performance judgment.
- Date and "then vs now" context always visible in comparison screens.
- Minimal friction navigation:
  - Home (Journeys)
  - Journey Detail (Timeline)
  - Record
  - Progress (Compare/Milestones)
  - Settings

## 10. Screen List (MVP)

1. Splash / Auth Gate
2. Sign In / Sign Up
3. Journeys List (home)
4. Create/Edit Journey
5. Journey Detail (timeline + streak + record CTA)
6. Camera Record Screen
7. Clip Preview/Save Screen
8. Clip Player (full screen)
9. Comparison Picker + Player
10. Milestone Gallery + Milestone Player
11. Export/Share Confirmation
12. Notification Settings
13. Account & Privacy Settings

## 11. Data Model (MVP)

### Entity: `users`

- `id` (uuid, pk)
- `email` (unique, nullable for social-only)
- `auth_provider` (enum: email, apple, google)
- `display_name` (string)
- `timezone` (string, IANA)
- `created_at`, `updated_at`

### Entity: `journeys`

- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `title` (string, required)
- `category` (string, nullable)
- `color_theme` (string, nullable)
- `goal_text` (string, nullable)
- `started_at` (timestamp)
- `archived_at` (timestamp, nullable)
- `created_at`, `updated_at`

### Entity: `clips`

- `id` (uuid, pk)
- `journey_id` (fk -> journeys.id)
- `recorded_on` (date, user-local)
- `recorded_at` (timestamp UTC)
- `duration_ms` (int)
- `video_original_url` (string)
- `video_compressed_url` (string)
- `thumbnail_url` (string)
- `day_index` (int, starts at 1)
- `created_at`, `updated_at`

Constraints:

- Unique index on (`journey_id`, `recorded_on`) for one clip/day/journey in MVP.

### Entity: `streaks`

- `journey_id` (pk/fk)
- `current_streak_days` (int)
- `longest_streak_days` (int)
- `last_recorded_on` (date)
- `updated_at`

### Entity: `comparison_renders`

- `id` (uuid, pk)
- `journey_id` (fk)
- `type` (enum: day1_vs_latest, day7_vs_latest, day30_vs_latest, custom_v2)
- `from_clip_id` (fk -> clips.id)
- `to_clip_id` (fk -> clips.id)
- `render_status` (enum: queued, processing, complete, failed)
- `output_url` (string, nullable)
- `created_at`, `updated_at`

### Entity: `milestone_renders`

- `id` (uuid, pk)
- `journey_id` (fk)
- `milestone_day` (int)
- `render_status` (enum: queued, processing, complete, failed)
- `output_url` (string, nullable)
- `created_at`, `updated_at`

### Entity: `notification_preferences`

- `user_id` (pk/fk)
- `daily_reminder_enabled` (bool)
- `daily_reminder_local_time` (time)
- `milestone_notifications_enabled` (bool)
- `created_at`, `updated_at`

## 12. API Requirements (MVP)

Base: `/v1`

### Auth

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/oauth/{provider}`
- `POST /auth/logout`
- `GET /auth/me`

### Journeys

- `GET /journeys`
- `POST /journeys`
- `GET /journeys/{journeyId}`
- `PATCH /journeys/{journeyId}`
- `DELETE /journeys/{journeyId}` (soft delete/archive)

### Clips

- `POST /journeys/{journeyId}/clips/upload-url` (pre-signed upload URL)
- `POST /journeys/{journeyId}/clips` (create clip record)
- `GET /journeys/{journeyId}/clips` (timeline list, paginated)
- `GET /journeys/{journeyId}/clips/{clipId}`
- `PUT /journeys/{journeyId}/clips/{clipId}` (replace same-day clip)

### Comparisons

- `POST /journeys/{journeyId}/comparisons` (queue render by type)
- `GET /journeys/{journeyId}/comparisons`
- `GET /comparisons/{comparisonId}`

### Milestones

- `GET /journeys/{journeyId}/milestones`
- `POST /journeys/{journeyId}/milestones/{day}/render` (manual retry/admin use)
- `GET /milestones/{milestoneId}`

### Streaks and Notifications

- `GET /journeys/{journeyId}/streak`
- `GET /users/me/notifications`
- `PATCH /users/me/notifications`

### Export/Share

- `POST /exports` (register export event/analytics)

## 13. Background Jobs

- Clip processing job:
  - Generate compressed MP4 derivative.
  - Generate thumbnail.
  - Update clip status.
- Comparison render job:
  - Compose two clips with labels/date overlays.
- Milestone render job:
  - Select clip sequence and stitch with transitions.
- Notification scheduler:
  - Daily reminders based on local timezone.
  - Milestone completion notifications.

## 14. Analytics and Events

Track minimum event set:

- `signup_completed`
- `journey_created`
- `record_opened`
- `clip_recorded`
- `clip_saved`
- `timeline_viewed`
- `comparison_requested`
- `comparison_viewed`
- `milestone_generated`
- `milestone_viewed`
- `export_started`
- `export_completed`
- `reminder_enabled`
- `streak_incremented`

Key metrics:

- D1, D7, D30 retention.
- Weekly active recorders.
- Avg clips/user/week.
- Comparison generation rate.
- Milestone generation and share rate.

## 15. Acceptance Criteria (MVP)

1. New user can create first journey and record first clip in under 2 minutes.
2. Saved clip appears in timeline immediately.
3. Day 1 vs Latest comparison available once >= 2 clips exist.
4. 7-day milestone video appears automatically after day 7 clip is saved.
5. User can export comparison/milestone video to device and native share sheet.
6. Streak count updates correctly across consecutive and missed days in user timezone.
7. Daily reminder triggers at configured local time.

## 16. Risks and Mitigations

- Risk: Recording friction reduces retention.
  - Mitigation: one-tap record entry, short clip defaults, minimal form input.
- Risk: Video rendering delays hurt trust.
  - Mitigation: async status UI + retry policy + push notification on completion.
- Risk: Storage and processing cost growth.
  - Mitigation: compressed derivatives, retention policy options in v2.
- Risk: Users miss reminders due to permission denial.
  - Mitigation: in-app reminder banner and settings education.

## 17. V1/V2 Backlog

### V1 (Must Have)

- Auth + profile basics.
- Multi-journey support.
- Daily clip capture/upload.
- Timeline with playback.
- Core comparisons (Day 1/7/30 vs latest).
- Milestone montage (7/30/90/365).
- Streak + daily reminders.
- Export/share.
- Basic analytics instrumentation.

### V1.1 (Should Have)

- Clip retake/replace UX improvements.
- Better montage style templates.
- Reminder smart nudges for missed days.
- Offline clip queue with deferred upload.

### V2 (Could Have)

- Community challenges and skill groups.
- Public creator profiles.
- Progress feed/discovery.
- 30-day guided programs.
- AI-generated coaching insights and caption suggestions.
- Custom comparison picker (any two dates).
- Grace-day streak rules and advanced habit analytics.

## 18. Open Decisions

1. Tech stack:
   - Mobile: React Native vs native iOS/Android.
   - Backend: Node/TypeScript vs alternative.
2. Video pipeline:
   - Cloud transcoding provider selection.
3. Storage policy:
   - Keep originals forever vs optional archive tiers.
4. Auth:
   - Whether to require social login at launch or keep email-first.
5. Share branding:
   - Include Hone watermark by default (on/off).

## 19. Delivery Plan (Suggested)

### Phase 1 (Weeks 1-3): Foundation

- Auth, journey model, camera flow, clip upload/storage.

### Phase 2 (Weeks 4-6): Progress Core

- Timeline UI, streak logic, comparison generation.

### Phase 3 (Weeks 7-8): Motivation + Sharing

- Milestone montage pipeline, reminders, export/share.

### Phase 4 (Weeks 9-10): Stabilization

- QA pass, analytics validation, performance tuning, beta launch.

