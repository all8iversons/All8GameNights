# Quickstart: Game Night Player Tools

## Prerequisites

- Node.js/npm, Docker Desktop, and the Supabase CLI
- Dependencies installed with `npm install`

## Start local services

From the project root:

```text
npm run start:local
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`. The command starts local Supabase, applies migrations, and serves the frontend and Edge Functions.

## Validate the feature

1. Create a game night and add at least two players.
2. Start play, then add a third player; verify the roster updates with a zero score.
3. Create teams using either **Number of teams** or **Players per team**; verify space-themed names, balanced assignments, replacement of old teams, and preserved individual scores. Use **Randomize players across teams** to reshuffle within the existing teams.
4. Draw different challenges for two players. Start one timer, start the other, pause one, and verify the other remains running.
5. Finish one round, draw the next unused challenge for that player, and verify the prior round remains in the history of rounds without blocking the new assignment.
6. Draw unfinished challenges for two teammates and trade them; verify their assignments swap once. Confirm the trade control excludes teammates with a running timer, and that the room-code disclosure is visible.
7. As the host, turn on **Wide-screen view** to show team standings and each player’s challenge and live timer together. Exit the view to return to the regular board.
8. Share the six-digit join code with a spectator and verify the board opens. Submit a score change for a player; verify individual standings and the player's team total update. Confirm the casual shared-code warning is visible. Invalid join-code attempts are limited to 10 per IP per 15 minutes.
9. Attempt score, roster, team, timer, draw, and trade changes after completing the game; verify each is rejected and the completed result remains unchanged.
10. Reload or reconnect viewers and verify the snapshot preserves players, team assignments, scores, round assignments, and timer state.

Run focused automated checks:

```text
npm run build
npm run lint
npm run test -- --run tests/unit/game-night.test.ts
npm run test:integration -- tests/integration/game-night.test.ts
npm run test:e2e -- tests/e2e/live-game-night.spec.ts
```

See [the API contract](./contracts/game-night-api.md) for request validation and error behavior, and [the data model](./data-model.md) for ownership and state rules.
