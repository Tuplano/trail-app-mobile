# Trail App — mobile

The Android and iOS app for Trail App: record hikes offline, sync them to the API, and share them. Built with Expo (development build), React Native, and TypeScript. The website lives in its own repository.

## Run it

1. Install dependencies: `npm install`
2. Start the API (`trail-app-api`) on port 3000.
3. Build and install the app on an emulator or phone (first time, or after adding a library with native code):

   ```bash
   npx expo run:android
   ```

4. After that, start Metro and open the installed app: `npm start`

In development the app finds the API on the same host as Metro, port 3000. To point it somewhere else, set `EXPO_PUBLIC_API_URL` in `.env.local` (see `.env.example`).

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Start Metro for the installed development build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Jest |
| `npm run gen:api` | Regenerate `src/api/schema.d.ts` from the running API's OpenAPI spec |

## Layout

| Folder | Holds |
| --- | --- |
| `src/app` | Screens (Expo Router: every file is a route) |
| `src/features` | Feature code: auth, profile, health check |
| `src/components/ui` | Reusable components (Button, Text, TextField, Screen…) |
| `src/theme` | Design tokens (colors, fonts, radii) |
| `src/api` | Typed API client |
| `src/db` | SQLite database, migrations, and queries |
| `src/tracking` | Hike recorder |
| `src/sync` | Uploading hikes (Stage 4) |
