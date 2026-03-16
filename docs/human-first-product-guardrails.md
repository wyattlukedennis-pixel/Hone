# Hone Human-First Product Guardrails

This document is the product filter for all design and engineering decisions.

## 1) Why Hone Exists

AI makes polished output cheap and instant. Human skill growth is slow, imperfect, and meaningful.

Hone exists to prove that human practice compounds over time.

Core emotional promise:

> You are not behind. You are building.

## 2) Product Core

Hone is a **proof engine**, not a task tracker.

Primary job:

- turn daily effort into visible proof of improvement

Primary lens:

- self vs self (never social comparison by default)

## 3) The Core Loop (Must Be Obvious)

1. Open app
2. Record today
3. Save clip
4. See progress proof

If a feature does not strengthen this loop, defer it.

## 4) V1 Scope

Build these extremely well:

1. Reliable capture and save (never lose a clip)
2. Clean calendar/timeline history
3. Instant comparison (Day 1 vs Today, plus tap-two-days compare)
4. Lightweight reinforcement (day count, streak, simple success moment)

Do not prioritize yet:

1. Social feed, comments, likes, profiles
2. Heavy analytics dashboards
3. Complex milestone systems
4. Broad customization/settings

## 5) UX Principles

1. One dominant action per screen
2. Practice screen must answer in 3 seconds:
   - what skill
   - what day
   - practiced today?
   - what next?
3. Reduce admin UI in the main flow
4. Keep language human, calm, encouraging

## 6) Signature Experience

Hone should feel like a **time machine for skill development**.

Signature surfaces:

1. Progress Mirror (first clip vs latest clip)
2. Calendar of effort (tap a day to replay, tap two days to compare)

Distinct from BeReal:

- BeReal captures a daily moment for social context.
- Hone captures a daily rep for long-term mastery.

## 7) Visual and Motion Guardrails

1. Simplicity before ornament
2. Motion should explain state change, not decorate
3. Reward moments should be short and clear
4. UI density must stay low around Record Today and comparison moments

## 8) Copy Guardrails

Prefer:

- Show up today.
- Proof of practice.
- Your skill is sharpening.
- Consistency builds mastery.

Avoid:

- productivity jargon
- social-media creator language
- fear-based AI framing

## 9) Decision Test (Use Before Shipping)

Before adding or changing anything, answer:

1. Does this make it more likely the user practices tomorrow?
2. Does this make progress more visible?
3. Does this reduce or increase cognitive load on the main loop?

If the answer is unclear, do not ship yet.

## 10) Planning Source of Truth

Execution sequencing for this reset lives in:

- [roadmap.md](./roadmap.md) (3-sprint plan)
- [jira_backlog.csv](./jira_backlog.csv) (active core-only backlog)
