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

## Folder structure

All code is in `src/`, in three layers. Each layer only uses the layers below it:

```
screens      src/app/           what's on screen, and where each screen lives in the app
  ↓
features     src/features/      the pieces a screen is built from, one folder per feature
  ↓
engine       src/tracking/      work that runs without any screen, even in the background
             src/sync/
             src/db/
```

```
src/
├── app/                      SCREENS. Expo Router: every file is a screen, its path is its URL
│   ├── _layout.tsx           Root: theme, splash screen, signed in or not
│   ├── sign-in.tsx           /sign-in
│   ├── sign-up.tsx           /sign-up
│   └── (app)/                Signed-in part. "(…)" groups files without adding to the URL
│       ├── _layout.tsx       Bottom tab bar, plus restoring a hike and starting sync on launch
│       ├── record.tsx        Record tab           /record
│       ├── (history)/        History tab, with its own stack so a hike opens inside the tab
│       │   ├── _layout.tsx   The stack (back button and header)
│       │   ├── index.tsx     List of hikes        /
│       │   └── hikes/[id].tsx  One hike           /hikes/123
│       ├── feed.tsx          Feed tab (placeholder until Stage 5)
│       └── profile.tsx       Profile tab
│
├── features/                 FEATURES. Components, hooks and logic for one part of the app
│   ├── auth/                 Sign in/up, session storage, token refresh
│   ├── record/               Record screen: map, stats, finish panel, permission cards
│   ├── history/              History screens: list rows, stats grid, elevation chart
│   └── profile/              Profile API calls and form validation
│
├── tracking/                 ENGINE: recording. GPS in the background, filtering points,
│                             distance and climb, the recorder's state (start/pause/finish)
├── sync/                     ENGINE: uploading. The outbox queue, retries, online/offline
├── db/                       ENGINE: the phone's SQLite database. Tables, migrations, queries
│
├── api/                      The API client. schema.d.ts is generated (npm run gen:api)
├── components/
│   ├── app-tabs.tsx          The bottom tab bar: which tabs, their order, labels and icons
│   └── ui/                   Shared building blocks: Button, Text, TextField, Screen, icons
├── theme/                    Colors, fonts, spacing, radii (from the design), and useColors()
└── config/                   Settings: API address, map styles
```

### Where do I find…

| I want to change… | Look in |
| --- | --- |
| A screen's layout | `src/app/…` (the screen), then the parts it imports from `src/features/<name>/` |
| The bottom tabs | `src/components/app-tabs.tsx` (and add the screen file in `src/app/(app)/`) |
| Colors, fonts, sizes | `src/theme/tokens.ts` |
| How a hike is recorded | `src/tracking/recorder-store.ts` (state), `location-task.ts` (background GPS) |
| How a hike is uploaded | `src/sync/upload-hike.ts` (one hike), `sync.ts` (when sync runs) |
| A database table or query | `src/db/` (new tables: a new entry in `migrations.ts`) |
| Number formats (km, pace, dates) | `src/features/record/format.ts`, `src/features/history/hike-summary.ts` |

### Rules of thumb

- **New screen?** A file in `src/app/`. Keep it short: put its components in `src/features/<name>/`.
- **Why are recording and uploading not in `features/`?** They must keep working with no screen open: GPS runs while the phone is locked, and uploads start when the signal comes back. So they don't depend on any screen code.
- **Tests** sit in a `__tests__/` folder beside the code they test (`src/db/hikes.ts` → `src/db/__tests__/hikes.test.ts`).
- **Files** are named in kebab-case (`hike-list-item.tsx`). Hooks start with `use-` (`use-hikes.ts`).
