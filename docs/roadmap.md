# Hone Implementation Roadmap

This roadmap translates the PRD into execution-ready epics and tickets for an MVP launch.

## Planning Assumptions

- Team: 1 mobile engineer, 1 backend engineer, 1 design/product generalist, 1 QA support (part-time).
- Sprint length: 2 weeks.
- Estimation scale: Story points (SP) using Fibonacci-like sizing (1, 2, 3, 5, 8).
- Release target: end of Sprint 5 (10 weeks).

## Milestones

1. M1 Foundation Complete (end Sprint 1)
2. M2 Recording + Timeline Functional (end Sprint 2)
3. M3 Progress Features Functional (end Sprint 3)
4. M4 Motivation + Sharing Functional (end Sprint 4)
5. M5 Beta Stable + Launch Ready (end Sprint 5)

## Epic Overview

| Epic ID | Epic | Outcome | Target Sprint |
|---|---|---|---|
| E1 | Project Foundation | App, backend, and infra scaffolded | 1 |
| E2 | Auth and Accounts | Users can register/login/logout | 1 |
| E3 | Journeys and Timeline | Users can create journeys and view progress timeline | 2 |
| E4 | Recording and Media Pipeline | Users can record, upload, and playback clips | 2 |
| E5 | Progress Engine | Users can view auto comparisons and milestone renders | 3 |
| E6 | Habit Reinforcement | Reminders and streak logic are reliable | 4 |
| E7 | Share and Export | Users can export and share progress videos | 4 |
| E8 | Analytics and Quality | Product metrics, testing, and stability gates are in place | 5 |
| E9 | Launch Readiness | Beta rollout, docs, and release checklist complete | 5 |

## Ticket Backlog

## E1 Project Foundation

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-001 | Initialize mobile app shell and navigation | 3 | Mobile | - | App launches with tab/navigation skeleton and environment switching. |
| HON-002 | Initialize backend service and health endpoints | 2 | Backend | - | `/health` and `/version` return expected metadata in dev/stage. |
| HON-003 | Provision storage buckets and CDN config | 3 | Backend | - | Public/private media buckets and signed URL flow configured. |
| HON-004 | Set up CI for lint, typecheck, unit tests | 3 | Backend | HON-001, HON-002 | Pull request checks run and block on failures. |
| HON-005 | Create shared error/logging conventions | 2 | Backend | HON-002 | Structured logs include request id, user id (if available), and error class. |

## E2 Auth and Accounts

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-010 | Design auth UX (email + one social provider) | 2 | Product/Design | HON-001 | Signed-off auth flow and edge states documented. |
| HON-011 | Implement signup/login/logout APIs | 5 | Backend | HON-002 | Endpoints implemented with validation, rate limiting, and session handling. |
| HON-012 | Implement mobile auth screens | 5 | Mobile | HON-010, HON-011 | User can sign up, log in, log out, and session persists after restart. |
| HON-013 | Implement `/auth/me` and profile bootstrap | 2 | Backend | HON-011 | Authenticated user data returned for app bootstrap. |
| HON-014 | Add auth instrumentation events | 1 | Mobile | HON-012 | `signup_completed` and login events tracked once per success. |

## E3 Journeys and Timeline

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-020 | Implement journeys schema and migrations | 3 | Backend | HON-002 | `journeys` table and indexes applied in dev/stage. |
| HON-021 | Implement journeys CRUD API | 5 | Backend | HON-020, HON-011 | User can create/list/update/archive own journeys only. |
| HON-022 | Build journeys list and create/edit screens | 5 | Mobile | HON-021 | User can create and manage multiple journeys from home screen. |
| HON-023 | Implement timeline API (paginated clips by journey) | 3 | Backend | HON-020 | Clips returned newest-first with day labels and metadata. |
| HON-024 | Build journey detail timeline UI | 5 | Mobile | HON-023 | Timeline displays clips, day index, streak summary, and record CTA. |

## E4 Recording and Media Pipeline

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-030 | Build record camera flow (5-10 sec guided) | 5 | Mobile | HON-001, HON-022 | User can record and preview a clip with duration guidance. |
| HON-031 | Implement signed upload URL endpoint | 3 | Backend | HON-003, HON-011 | Endpoint returns valid signed URL for authenticated user journey. |
| HON-032 | Implement clip create/replace API + uniqueness rule | 5 | Backend | HON-031, HON-020 | One clip/day/journey enforced, with replace support. |
| HON-033 | Connect mobile upload + save flow | 5 | Mobile | HON-030, HON-031, HON-032 | Clip uploads reliably and appears in timeline on save. |
| HON-034 | Implement clip processing worker (compress + thumbnail) | 5 | Backend | HON-003, HON-032 | Derivative video + thumbnail generated and status updated. |
| HON-035 | Build clip playback screen | 2 | Mobile | HON-033 | User can play clip full screen with smooth startup. |

## E5 Progress Engine

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-040 | Implement comparison selection logic | 3 | Backend | HON-032 | Day1/7/30 vs latest candidates selected correctly when available. |
| HON-041 | Implement comparison render worker + API | 5 | Backend | HON-040, HON-034 | Comparison job queues, renders, and updates status/output URL. |
| HON-042 | Build comparison picker/player UI | 5 | Mobile | HON-041, HON-024 | User can open, play, and retry comparison renders. |
| HON-043 | Implement milestone eligibility logic (7/30/90/365) | 2 | Backend | HON-032 | Milestones trigger once per journey at valid day counts. |
| HON-044 | Implement milestone montage worker + API | 5 | Backend | HON-043, HON-034 | Montage renders and is retrievable in milestone list. |
| HON-045 | Build milestone gallery/player UI | 3 | Mobile | HON-044 | User can view generated milestone videos with date/day context. |

## E6 Habit Reinforcement

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-050 | Implement streak calculation service | 3 | Backend | HON-032 | Current and longest streak update correctly by user timezone. |
| HON-051 | Expose streak endpoint and timeline integration | 2 | Backend | HON-050 | Journey detail API includes streak values. |
| HON-052 | Build notification preference API | 2 | Backend | HON-011 | User can configure reminder toggles and local reminder time. |
| HON-053 | Build notification settings screen | 3 | Mobile | HON-052 | User can enable/disable reminders and set local time. |
| HON-054 | Implement reminder scheduler + push delivery | 5 | Backend | HON-052 | Daily reminders send at configured local time with retries. |
| HON-055 | Add milestone celebration cards/notifications | 2 | Mobile | HON-044, HON-054 | User sees celebration card and receives milestone completion notice. |

## E7 Share and Export

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-060 | Implement export endpoint/audit event | 2 | Backend | HON-041, HON-044 | Export requests logged with media type and completion status. |
| HON-061 | Build mobile export to local media library | 3 | Mobile | HON-042, HON-045 | User can save rendered video to device gallery. |
| HON-062 | Integrate native share sheet | 2 | Mobile | HON-061 | User can share exported media through native share options. |
| HON-063 | Add export/share analytics instrumentation | 1 | Mobile | HON-061 | `export_started` and `export_completed` tracked correctly. |

## E8 Analytics and Quality

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-070 | Implement event tracking schema and client | 3 | Backend | HON-005 | Event pipeline validates and stores core event payloads. |
| HON-071 | Integrate MVP event catalog in mobile | 3 | Mobile | HON-070 | All PRD events emitted at expected user actions. |
| HON-072 | Add backend unit/integration test suite for core APIs | 5 | Backend | HON-021, HON-032, HON-041 | Critical APIs have happy/edge-path coverage and CI enforcement. |
| HON-073 | Add mobile test coverage for core flows | 5 | Mobile | HON-033, HON-042, HON-053 | Smoke tests cover auth, record, timeline, comparison flow. |
| HON-074 | Performance pass: timeline, playback, render queue | 3 | Backend | HON-072 | Meets NFR thresholds for startup, playback start, render reliability. |

## E9 Launch Readiness

| Ticket | Title | SP | Owner | Depends On | Acceptance Criteria |
|---|---|---:|---|---|---|
| HON-080 | Write beta test plan and bug triage workflow | 2 | Product/QA | HON-073 | Test plan includes device matrix and severity SLA definitions. |
| HON-081 | Prepare privacy policy and account deletion flow copy | 2 | Product | HON-011 | Legal/privacy copy finalized and reflected in-app. |
| HON-082 | Build release checklist and rollback playbook | 2 | Backend | HON-074 | Versioning, rollback steps, and on-call ownership documented. |
| HON-083 | Run closed beta, capture feedback, triage top issues | 5 | Cross-functional | HON-080, HON-082 | Top-priority beta issues resolved or accepted with rationale. |
| HON-084 | Launch readiness review and go/no-go decision | 1 | Product | HON-083 | Stakeholders approve metrics, quality, and support readiness. |

## Sprint Plan (10 Weeks)

## Sprint 1: Foundation + Auth APIs

- Target tickets: HON-001..HON-005, HON-010, HON-011, HON-013
- Goal: infrastructure and auth backend ready; app shell running.

## Sprint 2: Auth UX + Journeys + Recording Base

- Target tickets: HON-012, HON-014, HON-020..HON-024, HON-030, HON-031
- Goal: signed-in user can create journey and open record flow.

## Sprint 3: Upload/Timeline + Progress Core

- Target tickets: HON-032..HON-035, HON-040..HON-043
- Goal: daily clip saved to timeline; comparison/milestone selection logic complete.

## Sprint 4: Rendering + Habit + Sharing

- Target tickets: HON-044, HON-045, HON-050..HON-055, HON-060..HON-063
- Goal: milestone/comparison renders visible; reminders, streak, export/share working.

## Sprint 5: Quality + Beta + Launch Readiness

- Target tickets: HON-070..HON-074, HON-080..HON-084
- Goal: metrics instrumented, quality gates passed, closed beta complete.

## Definition of Done (Per Ticket)

- Code merged with CI green.
- Tests added/updated for behavior changes.
- Error states handled and logged.
- Analytics events implemented (if user-visible feature).
- UX copy and loading/empty/error states included.
- Documentation updated for new API or infrastructure changes.

## Cross-Epic Dependencies and Critical Path

1. Auth (`HON-011`) must land before journey and clip ownership flows.
2. Signed upload pipeline (`HON-031`, `HON-032`, `HON-034`) gates timeline and progress features.
3. Comparison/milestone render jobs (`HON-041`, `HON-044`) gate share/export experience.
4. Streak/reminder services (`HON-050`, `HON-054`) are needed for retention loops before beta.
5. Analytics and test automation (`HON-070`..`HON-074`) must complete before go/no-go.

## Launch KPIs and Exit Criteria

Ship MVP when all are true:

- D1 clip completion rate baseline established and > 45% in beta cohort.
- D7 retention baseline established and > 25% in beta cohort.
- Clip upload success >= 98%.
- Render job completion >= 99% with retries.
- No open Sev-1 defects and no unresolved privacy/security blockers.

## Immediate Next Tickets (Suggested Start Order)

1. HON-001 Initialize mobile app shell and navigation.
2. HON-002 Initialize backend service and health endpoints.
3. HON-003 Provision storage buckets and CDN config.
4. HON-011 Implement signup/login/logout APIs.
5. HON-020 Implement journeys schema and migrations.

