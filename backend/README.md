# Hone Backend

Node.js + TypeScript API service for Hone.

## Endpoints

- `GET /health`
- `GET /version`
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /journeys`
- `POST /journeys`
- `GET /journeys/:journeyId`
- `PATCH /journeys/:journeyId`
- `DELETE /journeys/:journeyId`
- `POST /journeys/:journeyId/clips/upload-url`
- `POST /uploads/:uploadId`
- `POST /journeys/:journeyId/clips`
- `GET /journeys/:journeyId/clips`

## Local Run

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Uploaded clip files are stored locally under `UPLOADS_DIR` (default `./uploads`) and served from `/media/*`.
