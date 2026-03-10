# Hone Mobile

React Native (Expo) mobile shell for Hone.

## Local Run

```bash
cp .env.example .env
npm install
npm run dev
```

Current scaffold includes:

- Tab-style app shell (`Journeys`, `Progress`, `Settings`)
- Environment badge using `EXPO_PUBLIC_APP_ENV`
- Placeholder screens aligned to MVP information architecture
- Auth gate with login/signup, token persistence, and logout
- Journey CRUD plus in-app 5-10s practice recording with upload/save flow

## API URL notes

- iOS simulator can use `http://localhost:4000`.
- Physical devices need your machine LAN IP, for example `http://192.168.x.x:4000`.
- Camera recording requires granting camera permission in Expo Go.
