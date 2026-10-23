# Game Night Showdown

A React game-night scoreboard with live spectator updates, timed video-game challenges, and a persistent winner history.

## Requirements

- Node.js LTS and npm
- Docker Desktop and the Supabase CLI for local database, function, and Realtime development
- Google Chrome or another Playwright-supported browser for end-to-end tests

## Local development

1. Install Docker Desktop, Node.js/npm, and the Supabase CLI.
2. From the project folder, install dependencies and start everything with:

   ```text
   npm install
   npm run start:local
   ```

The command starts Supabase, applies any pending migrations, and writes the local URL and publishable key to the ignored `.env.local` file automatically. It does not reset the database, so local game results are preserved between runs. Vite and the Supabase Edge Functions run together in this terminal; open the address Vite prints, usually `http://localhost:5173`.

Press `Ctrl+C` to stop the app and function servers. To also stop the local Supabase containers, run `npm run stop:local`. The local database is preserved between starts; `npm run start:local` does not reset it.

If you intentionally want to erase and recreate the local database and reload the challenge catalog, run `supabase db reset`. This only affects the local Supabase database.

## Unraid deployment

See the [Unraid deployment guide](deploy/unraid/README.md) for running the app and its self-hosted Supabase services through Compose-Craft. The deployment uses its own PostgreSQL and appdata paths; the existing MariaDB/MySQL server and its WoW data remain unchanged.

For a deployed environment, configure `ALLOWED_ORIGIN` on the Edge Functions with the exact website origin. Configure Supabase's project URL and publishable key in the frontend environment. Keep the server-side Supabase secret/service-role key in Supabase function secrets only; never use a `VITE_` prefix for a privileged key.

The host recovery key is separate from the spectator code. The app keeps host access in the current browser tab session, so a reload can restore it; use the private recovery key shown on the board to reconnect from another device. Anyone with both the room code and recovery key can control the host settings, so keep the key private. Completed game results are retained in the database; completed results are not editable in this initial version.

## Validation

```text
npm run build
npm run lint
npm test
npm run test:deployment
npm run test:integration
npm run test:e2e
```

Integration tests run against the local Edge Functions when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. Without them, those integration tests are skipped. End-to-end tests use a mocked backend so core browser journeys can be exercised without a hosted service.
