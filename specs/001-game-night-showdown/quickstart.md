# Quickstart: Game Night Showdown

This guide describes the planned local validation flow. The repository currently contains the specification but not yet the React app or package scripts; implementation should add the scripts listed below before this guide is used.

## Prerequisites

- A maintained Node.js LTS release and npm
- Supabase CLI and Docker for local database/functions/realtime testing
- A modern browser

## Start the local app and backend

From the repository root after implementation:

1. Install dependencies with `npm install`.
2. Start the local Supabase stack with `supabase start`.
3. Apply migrations and seed the precreated challenge catalog with `supabase db reset`.
4. Start the React development server with `npm run dev`.
5. Open the local address printed by Vite.

Use only local/test credentials. Do not place a Supabase service-role key or host capability in client source, a spectator link, or test output.

## Validate the primary host/viewer flow

1. Open the app and create a game night. Confirm that the host receives a host control session and a separate spectator code.
2. Add two participants while the night is in setup, then start the night.
3. Open the spectator view in a second browser context using the spectator code.
4. Change a participant's score from the host context. Confirm the spectator view updates and displays ties correctly.
5. Draw a challenge, record its identity, then draw again. Confirm that the second draw is a different unused challenge.
6. Continue drawing until the challenge catalog is exhausted. Confirm the UI reports that no unused challenges remain.
7. Start a positive-duration timer. Confirm both contexts show the same challenge and countdown; pause, resume, and reset it. Confirm expiry is signaled.
8. Complete the night. Confirm the historical leaderboard shows the date, final scores, and every tied winner.
9. Reload the viewer and reopen the historical leaderboard. Confirm completed results remain available.

## Automated checks

The implementation should expose these commands:

```text
npm run test                 # Unit and component tests
npm run test:integration      # Local Supabase function/database integration tests
npm run test:e2e              # Browser journey tests
npm run build                # Production build and type checks
```

At minimum, automated coverage must verify score validation and idempotency, challenge draw uniqueness under concurrent requests, exhausted challenge pools, timer transitions and expiration, authorization separation, completion/tie handling, and viewer resynchronization after reconnect. Measure the score-update target from the host mutation to the rendered spectator state under the local test environment.
