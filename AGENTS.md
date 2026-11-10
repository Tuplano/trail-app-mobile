This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Task workflow (Notion)

Work comes from the Notion **Mobile Tasks** board (Trail App → Mobile Tasks, data source `collection://4d085d9e-9c15-45b1-9c85-fe419a8caca2`). Work on one task at a time, in `Order`. Ask before skipping or reordering a task.

1. **Start:** set the task's Status to **In progress** before writing code.
2. **Build:** base the task on the design (see "Follow the design" below) and follow the existing patterns in the app.
3. **Check:** run lint, typecheck and tests (`npm test`). They must pass before the task is reported as finished.
4. **Explain:** when the task is built, explain it in simple, plain words that someone learning React Native can follow:
   - **What it does** from the user's point of view, and how it works in a few sentences.
   - **What changed:** the files added or changed, one line each.
   - **How to test it** on the emulator or phone, step by step, including whether a rebuild (`npx expo run:android`) is needed or a Metro reload is enough.
   - **Possible problems and gaps:** think it through and list edge cases that aren't handled, things that only a real device can confirm, trade-offs made (e.g. a threshold that may need tuning), and what is left for later tasks. Say which ones matter now and which can wait.
   - A suggested commit message.
5. **Commit:** the user reviews and commits. Don't commit unless asked.
6. **Done:** only after the user says they committed: check the commit in `git log`, set Status to **Done**, and write a one-line summary plus the commit hash in the task's Notes. Never mark a task Done before that.

## Follow the design

Every task is based on the **Trail Mobile** Claude Design project: https://claude.ai/design/p/7df451d6-0b65-457b-9b7d-8e148cbc5d82?file=Trail+Mobile.dc.html (main file `Trail Mobile.dc.html`, which imports `support.js`).

- **Before building:** find the design screen(s) the task touches (sign-in, permissions, record, history, detail, compose, feed, privacy, profile, maps, settings) and build to them: layout, states, and the exact wording of labels, chips, notes and empty/offline messages. The colors in `src/theme/tokens.ts` come from the design.
- **Look at it rendered**, not only at its markup. The app is dark, like the design, with four tabs: Record, History, Feed, Profile. A screen that isn't built yet gets a "coming soon" placeholder.
- **If the task and the design disagree**, or the design needs something the API doesn't have yet, ask before choosing.
- **Before reporting:** compare a screenshot of the app with the design, and list any differences that remain and why.

## Follow the existing patterns

Read the neighbouring files before writing new code, and match what's there. Don't introduce a new library, folder or pattern without asking first. Current patterns:

- **Folders:** `src/app/` routes only. `src/features/<name>/` holds UI-facing feature code (screens' components, hooks, API calls, validation). `src/tracking/`, `src/sync/` and `src/db/` are the engine that runs without a screen (background tasks, SQLite, upload queue). `src/api/` is the generated API client. `src/components/ui/` holds shared UI building blocks.
- **Database:** functions in `src/db/` take a `Db` as their first argument so tests can pass a real in-memory SQLite (`createTestDb()`). Schema changes are new entries in `MIGRATIONS`; never edit a shipped migration. Times are epoch milliseconds.
- **State:** Zustand stores (`create<State>()(…)`), server data with TanStack Query.
- **Styling:** `StyleSheet.create`, colors from `useColors()`, sizes from `src/theme/tokens.ts`, and the `Text`, `Button`, `Screen` components from `src/components/ui/`. No hard-coded colors.
- **Logic vs UI:** keep decisions in plain, pure functions that can be unit-tested (e.g. `decideLocationAccess`, `filterPoints`), with native calls kept thin around them.
- **Tests:** in a `__tests__/` folder inside the folder of the code they test, named `<file>.test.ts` (e.g. `src/db/hikes.ts` → `src/db/__tests__/hikes.test.ts`, importing `'../hikes'`). Jest only runs `__tests__/**/*.test.ts`, so test helpers such as `src/db/__tests__/test-db.ts` can sit beside them. Mock native modules (`expo-location`, `expo-crypto`), not the database.
- **Comments:** explain *why*, in plain language, on exported functions and non-obvious code.
