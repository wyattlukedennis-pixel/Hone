# Hone Monorepo

This repository contains the initial Sprint 1 baseline for Hone:

- `mobile/`: React Native (Expo) app shell.
- `backend/`: Node.js + TypeScript API service.
- `infra/terraform/`: AWS IaC for storage buckets and CDN.
- `docs/`: product and planning documents.
  - Product guardrails: [docs/human-first-product-guardrails.md](docs/human-first-product-guardrails.md)
  - Current execution board: [docs/execution-board-2026-03-11.md](docs/execution-board-2026-03-11.md)

## Tech Decisions (Locked)

- Mobile: React Native with Expo.
- Backend: Node.js + TypeScript + PostgreSQL.
- Media storage: S3-compatible buckets.
- CDN: CloudFront.
- Auth in MVP: Email/password plus one social provider.

See [docs/tech-decisions.md](docs/tech-decisions.md) for details.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start backend

```bash
cd backend
cp .env.example .env
npm run dev
```

### 3. Start mobile app

```bash
cd mobile
npm run dev
```

### 4. Run checks

```bash
npm run ci
```
