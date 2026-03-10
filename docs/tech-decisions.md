# Hone Tech Decisions

Date: March 10, 2026

## Finalized Decisions

1. Mobile stack
- React Native with Expo.
- Reason: fastest path to cross-platform MVP with efficient iteration.

2. Backend stack
- Node.js + TypeScript with Fastify.
- PostgreSQL as the primary relational database.
- Reason: strong developer velocity and typed API surface.

3. Video/storage pipeline
- S3-compatible object storage for raw and processed media.
- Worker-based processing pipeline for compression, thumbnails, and render jobs.

4. CDN strategy
- CloudFront distribution for processed media delivery.
- Private storage with controlled delivery through CloudFront origin access control.

5. Authentication
- Email/password for MVP baseline.
- One social auth provider added in MVP implementation phase.

## Notes

- The current repository includes infrastructure templates and service scaffolding for these decisions.
- Provider credentials, production secrets, and deployment environments are intentionally not committed.
