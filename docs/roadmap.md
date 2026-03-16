# Hone 3-Sprint Core Roadmap (Human-First Reset)

This roadmap replaces the prior 5-sprint, feature-broad plan.

It is intentionally narrow and follows [human-first-product-guardrails.md](./human-first-product-guardrails.md).

## North Star

Hone is a proof engine for human progress.

Core loop:

1. Open app
2. Record today
3. Save clip
4. See visible proof of progress

## What We Are Not Building In This Plan

- social feed / comments / likes
- export/share growth features
- advanced rendering workers for milestone reels
- broad settings complexity

Those can return after the core loop is clearly strong.

## Sprint Structure

- Sprint length: 2 weeks
- Team assumption: 1 mobile, 1 backend, 1 product/design generalist
- Total horizon: 3 sprints / 6 weeks

## Sprint 1: Core Capture Reliability

Goal: Make daily capture trustworthy and fast.

### Must ship

- auth and session bootstrap are stable
- one active journey opens cleanly
- record flow (5-10s) is frictionless
- save/upload is reliable with explicit states and retry path
- post-save success feedback confirms progress was logged

### Exit criteria

- clip save success >= 98% in dev/beta testing
- no clip-loss bugs open
- median time from app-open to recording-start <= 8 seconds (returning user, one active journey)

## Sprint 2: Calendar + Comparison Proof

Goal: Make improvement visible with minimal cognitive load.

### Must ship

- calendar-style history surface (recorded days visible immediately)
- tap day to replay that day’s clip
- tap two days to compare
- Day 1 vs Today quick access is prominent
- comparison playback is smooth and reliable

### Exit criteria

- users can complete compare flow in <= 2 taps from progress surface
- calendar load/playback stable on low-end and high-end devices in test matrix

## Sprint 3: Retention Basics + Quality

Goal: Reinforce daily return without feature bloat.

### Must ship

- streak/day count backed by reliable logic
- simple reminder controls (daily time)
- lightweight reward moments after save (copy + subtle motion/haptic)
- core event instrumentation for loop health
- regression tests for auth -> record -> save -> compare

### Exit criteria

- core events tracked with low error rate
- no Sev-1/Sev-2 defects in main loop
- loop-level smoke tests pass in CI

## Ticket Mapping (Active)

Backlog rows are kept in [jira_backlog.csv](./jira_backlog.csv) and trimmed to active scope only.

- Sprint 1: Foundation/Auth/Journey/Capture reliability tickets
- Sprint 2: Calendar + comparison proof tickets
- Sprint 3: Retention-lite + quality tickets

## Decision Rule

Every proposed feature/change must pass:

1. Does it increase likelihood user practices tomorrow?
2. Does it make progress more visible?
3. Does it reduce (not add) cognitive load in the core loop?

If not, defer.
