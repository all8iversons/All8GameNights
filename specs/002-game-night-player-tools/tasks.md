# Tasks: Game Night Player Tools

**Input**: Design documents from `specs/002-game-night-player-tools/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/game-night-api.md

**Organization**: Tasks are grouped by user story so each capability can be implemented and verified as an increment.

## Phase 1: Setup

**Purpose**: Reuse the existing app, Supabase, and test configuration; no new project setup is required.

No setup tasks.

---

## Phase 2: Foundational

**Purpose**: Add shared persistence and snapshot structures required by the user stories.

- [x] T001 Add an additive migration in `supabase/migrations/003_game_night_player_tools.sql` that creates same-night teams, adds nullable team assignment to participants, adds player and finish fields to challenge rounds, backfills existing rounds to the earliest participant in their game night, and enforces same-night team membership and one unfinished round per player.
- [x] T002 [P] Extend the shared domain types in `src/features/game-night/types.ts` with team membership, derived team totals, assigned participant IDs, and round completion state.
- [x] T003 Update snapshot mapping in `supabase/functions/game-nights/shared.ts` and `supabase/functions/game-nights/read.ts` to return participants, derived team totals, and participant-scoped challenge rounds while preserving existing response fields.

**Checkpoint**: Schema and shared snapshots are ready for story-level handlers and UI.

---

## Phase 3: User Story 1 - Add players during a game (Priority: P1)

**Goal**: Let the host add a valid player before or during active play, with immediate live standings updates.

**Independent Test**: Start a game with one player, add a second during active play, and verify the new player appears with score zero. Verify duplicate and completed-game requests fail without changing the roster.

### Tests for User Story 1

- [x] T004 [P] [US1] Add integration coverage for setup and active additions, duplicate names, and completed-night rejection in `tests/integration/game-night.test.ts` and `tests/integration/leaderboard.test.ts`.
- [x] T005 [P] [US1] Add an end-to-end scenario that adds a player after game start and checks the live roster in `tests/e2e/live-game-night.spec.ts`.

### Implementation for User Story 1

- [x] T006 [US1] Update `supabase/functions/game-nights/participants.ts` to accept host-authorized additions in setup or active status while retaining trimmed 1-40 character names and duplicate-name errors.
- [x] T007 [US1] Update `src/features/game-night/HostControls.tsx` and `src/features/game-night/GameNightPage.tsx` to keep the add-player form available during active play and display save errors.

**Checkpoint**: A host can add late-arriving players without ending or restarting the game.

---

## Phase 4: User Story 2 - Run individual challenges and timers (Priority: P1)

**Goal**: Assign unique challenges to individual players and independently control each player's timer and round.

**Independent Test**: Draw challenges for two players, start both timers, pause or finish one, and verify the other round and timer remain unchanged.

### Tests for User Story 2

- [x] T008 [P] [US2] Add integration coverage for participant-targeted unique draws, one unfinished round per player, independent timers, finish-versus-reset behavior, and exhausted challenges in `tests/integration/game-night.test.ts` and `tests/integration/challenges.test.ts`.
- [x] T009 [P] [US2] Add an end-to-end scenario for parallel player rounds and independent timer controls in `tests/e2e/challenge-timer.spec.ts`.

### Implementation for User Story 2

- [x] T010 [US2] Update the draw and timer database functions in `supabase/migrations/003_game_night_player_tools.sql` to serialize player-targeted draws, enforce one unfinished round per player, and support finishing a round without repeating a challenge.
- [x] T011 [US2] Update `supabase/functions/game-nights/draw-challenge.ts`, `supabase/functions/game-nights/challenge-timer.ts`, `supabase/functions/game-nights/index.ts`, and `src/features/game-night/game-night-api.ts` to require a target participant for draws and support the explicit finish action.
- [x] T012 [US2] Replace the single current challenge/timer controls in `src/features/game-night/GameNightPage.tsx` with player-scoped challenge cards and independent timer actions, using `src/features/challenge/ChallengePanel.tsx` and `src/features/timer/ChallengeTimer.tsx`.

**Checkpoint**: Multiple players can run separate rounds and timers; each player can only hold one unfinished round.

---

## Phase 5: User Story 3 - Organize players into teams (Priority: P2)

**Goal**: Let the host manage team membership and show team totals derived from individual scores.

**Independent Test**: Create two teams, assign and reassign players, update scores, and verify team totals and ties while unassigned players remain in individual standings.

### Tests for User Story 3

- [x] T013 [P] [US3] Add integration coverage for team creation, rename, removal, same-night assignment, duplicate names, and score-derived totals in `tests/integration/game-night.test.ts`.
- [x] T014 [P] [US3] Add an end-to-end scenario for team assignments and summed standings in `tests/e2e/live-game-night.spec.ts`.

### Implementation for User Story 3

- [x] T015 [US3] Add host-authorized team creation, rename, removal, and participant assignment handlers in `supabase/functions/game-nights/teams.ts`, `supabase/functions/game-nights/index.ts`, and `supabase/functions/game-nights/shared.ts`, validating names as trimmed 1-40 character values unique without case sensitivity per game night.
- [x] T016 [US3] Add typed team operations to `src/features/game-night/game-night-api.ts` and create team/assignment controls in `src/features/game-night/TeamControls.tsx`.
- [x] T017 [US3] Update `src/features/game-night/Scoreboard.tsx` and `src/features/game-night/GameNightPage.tsx` to show individual rankings, team totals, ties, and unassigned players.

**Checkpoint**: Hosts can manage teams during play and viewers see consistent individual and team standings.

---

## Phase 6: User Story 4 - Let players submit their scores (Priority: P2)

**Goal**: Let someone with the spectator code submit a score change under a selected player name, with clear disclosure that identity is not verified.

**Independent Test**: Submit a valid score with the spectator code, verify all viewers and the player's team total update, and verify invalid or completed-game requests do not change data.

### Tests for User Story 4

- [x] T018 [P] [US4] Add integration coverage for shared-code score submissions, invalid participant and delta rejection, idempotency, rate limiting, and completed-night rejection in `tests/integration/game-night.test.ts` and `tests/integration/leaderboard.test.ts`.
- [x] T019 [P] [US4] Add an end-to-end spectator score submission flow and verify the shared-code identity warning in `tests/e2e/live-game-night.spec.ts`.

### Implementation for User Story 4

- [x] T020 [US4] Update `supabase/functions/game-nights/score.ts` and `supabase/functions/game-nights/index.ts` to accept score submissions authorized by the spectator code without host credentials, enforce active status and participant membership, validate idempotency, and apply a public mutation rate limit.
- [x] T021 [US4] Update `src/features/game-night/Scoreboard.tsx`, `src/features/game-night/GameNightPage.tsx`, and `src/features/game-night/game-night-api.ts` with player score submission controls and a clear shared-code impersonation disclosure.

**Checkpoint**: Players can submit casual score changes, while game status, participant membership, and limits are enforced.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify behavior, compatibility, documentation, and all quality gates.

- [x] T022 [P] Update `specs/002-game-night-player-tools/contracts/game-night-api.md`, `specs/002-game-night-player-tools/data-model.md`, and `specs/002-game-night-player-tools/quickstart.md` to match final implementation behavior.
- [x] T023 Run `npm run build`, `npm run lint`, focused unit, integration, and end-to-end tests; fix feature regressions in the corresponding source and test files.
- [x] T024 Verify completed nights remain immutable and existing individual leaderboard behavior remains intact in `tests/integration/leaderboard.test.ts` and `tests/e2e/leaderboard.spec.ts`.
- [x] T025 Add `004_join_codes_and_team_randomization.sql` with an atomic balanced team shuffle and invalid join-code attempt limiting; generate collision-checked six-digit numeric codes while preserving existing long-code compatibility.
- [x] T026 Add the host team-randomization button and six-digit join-code input/display, plus integration and end-to-end coverage and matching feature documentation.
- [x] T027 Show each team's assigned players in team standings, indicate empty teams, and verify the displayed roster in the end-to-end flow.
- [x] T028 Add host controls for generating teams by count or players per team, using unique original space-themed names and atomically replacing team assignments without changing scores.
- [x] T029 Validate both sizing modes, invalid input, balanced randomized assignments, score preservation, and generated-team UI in integration and end-to-end tests.

---

## Phase 8: User Story 7 - Trade unfinished challenges with a teammate

**Goal**: Swap current unfinished challenges between teammates without changing the challenge pool or timer state.

**Independent Test**: Verify a same-team swap, idempotent retry, and rejection for running timers or different teams.

### Tests for User Story 7

- [x] T030 Add integration and end-to-end coverage for successful swaps, idempotent retry, cross-team rejection, and running-timer restrictions in `tests/integration/game-night.test.ts`, `tests/e2e/mock-backend.ts`, and `tests/e2e/challenge-timer.spec.ts`.

### Implementation for User Story 7

- [x] T031 Add the atomic challenge-trade RPC and request-idempotency persistence in `supabase/migrations/006_team_challenge_trades.sql`.
- [x] T032 Add the public room-code trade endpoint and API call in `supabase/functions/game-nights/trade-challenges.ts`, `supabase/functions/game-nights/index.ts`, and `src/features/game-night/game-night-api.ts`.
- [x] T033 Add teammate trade controls, running-timer eligibility feedback, and the shared room-code disclosure in `src/features/game-night/GameNightPage.tsx` and `src/features/challenge/ChallengePanel.tsx`.
- [ ] T034 Run build, lint, focused integration and end-to-end checks; resolve any regressions.

---

## Phase 9: User Story 8 - Remove a player and preserve history

**Goal**: Let hosts remove players during setup or active play without losing scores or challenge history.

**Independent Test**: Remove a player with a running challenge, verify the player is absent from active views, the timer is stopped and round finished, history is retained, and their name can be reused.

### Tests for User Story 8

- [x] T035 Add integration coverage for soft removal, history retention, stopped timers, rejected mutations, and name reuse in `tests/integration/game-night.test.ts`.
- [x] T036 Add end-to-end coverage for host removal and active roster updates in `tests/e2e/challenge-timer.spec.ts` and `tests/e2e/mock-backend.ts`.

### Implementation for User Story 8

- [x] T037 Add the soft-removal schema, host-authorized atomic removal function, active-participant filtering, and mutation guards in `supabase/migrations/007_player_removal_and_challenge_catalog.sql`, `supabase/functions/game-nights/participants.ts`, `supabase/functions/game-nights/shared.ts`, `supabase/functions/game-nights/start.ts`, `supabase/functions/game-nights/teams.ts`, and `supabase/functions/leaderboard/index.ts`.
- [x] T038 Add the host removal API and confirmation control in `src/features/game-night/game-night-api.ts` and `src/features/game-night/HostControls.tsx`.

---

## Phase 10: User Story 9 - Manage the shared challenge catalog

**Goal**: Let hosts maintain the shared challenge list, with edits reflected on current assignments and disablement limited to future draws.

**Independent Test**: Add, edit, and disable catalog challenges; verify authorization, immediate assignment updates, and future-draw behavior.

### Tests for User Story 9

- [x] T039 Add integration coverage for host authorization, shared catalog creation, edits to assigned challenges, and cleanup in `tests/integration/challenges.test.ts`.
- [x] T040 Add end-to-end coverage for catalog management in `tests/e2e/challenge-timer.spec.ts` and `tests/e2e/mock-backend.ts`.

### Implementation for User Story 9

- [x] T041 Add host-authorized shared catalog handlers and routes in `supabase/functions/game-nights/challenges.ts` and `supabase/functions/game-nights/index.ts`.
- [x] T042 Add the catalog API and host controls in `src/features/game-night/game-night-api.ts` and `src/features/game-night/ChallengeCatalogControls.tsx`.
- [x] T043 Broadcast catalog changes to game-night rooms and preserve current assignments in `supabase/migrations/007_player_removal_and_challenge_catalog.sql`.

---

## Phase 11: User Story 10 - Monitor up to 20 players in wide-screen mode

**Goal**: Fit a large active roster into a compact responsive host view with scores beside player cards.

**Independent Test**: Render 20 active players in wide-screen mode and verify all cards and score lines are present.

### Tests for User Story 10

- [x] T044 Add an end-to-end 20-player wide-screen layout scenario in `tests/e2e/challenge-timer.spec.ts` and `tests/e2e/mock-backend.ts`.

### Implementation for User Story 10

- [x] T045 Add compact player/score rows and responsive wide-screen columns in `src/features/game-night/GameNightPage.tsx` and `src/app/App.css`.

---

## Phase 12: Documentation and final verification

- [x] T046 Update the specification, API contract, data model, research, implementation plan, and quickstart with removal, shared catalog, and wide-screen behavior.
- [ ] T047 Verify migration, build, lint, focused integration, end-to-end, and diff checks; record unavailable external dependencies explicitly.
- [x] T048 Add integration and end-to-end coverage for replacing an unfinished challenge and preserving the stopped round in `tests/integration/challenges.test.ts` and `tests/e2e/challenge-timer.spec.ts`.
- [x] T049 Update the atomic challenge-draw operation and host control to confirm, stop, finish, and preserve replaced rounds in `supabase/migrations/007_player_removal_and_challenge_catalog.sql` and `src/features/challenge/ChallengePanel.tsx`.
- [x] T050 Document replacement confirmation, history retention, and no-challenges behavior in the feature spec, API contract, data model, and quickstart.
- [x] T051 Make wide-screen mode read-only for public display, remove score/challenge/timer mutation controls, reduce timer typography, and cover visibility in `src/features/game-night/Scoreboard.tsx`, `src/features/game-night/GameNightPage.tsx`, `src/features/challenge/ChallengePanel.tsx`, `src/app/App.css`, and `tests/e2e/challenge-timer.spec.ts`.
- [x] T052 Hide full-deck and ready-state notices only in wide-screen mode, retain them in the regular board, and cover both layouts in `src/features/challenge/ChallengePanel.tsx`, `src/features/timer/ChallengeTimer.tsx`, and `tests/e2e/challenge-timer.spec.ts`.
- [x] T053 Move each wide-screen score into the upper-right corner of its player card, remove the "Bonus round" label, and verify the 20-card layout in `src/features/game-night/GameNightPage.tsx`, `src/features/challenge/ChallengePanel.tsx`, `src/app/App.css`, and `tests/e2e/challenge-timer.spec.ts`.

---

## Phase 13: Host correction controls

### User Story 11 - Undo the latest challenge finish

- [x] T054 Add integration and end-to-end coverage for reopening the latest finished challenge, rejecting older rounds and existing unfinished rounds, and restoring timer state in `tests/integration/challenges.test.ts`, `tests/e2e/challenge-timer.spec.ts`, and `tests/e2e/mock-backend.ts`.
- [x] T055 Add an atomic host-only undo operation, API route, client method, and challenge-card control that reopens only the latest eligible round in `supabase/migrations/008_undo_challenge_finish_and_rename_players.sql`, `supabase/functions/game-nights/challenge-timer.ts`, `supabase/functions/game-nights/index.ts`, `src/features/game-night/game-night-api.ts`, `src/features/challenge/ChallengePanel.tsx`, and `src/features/game-night/GameNightPage.tsx`.

### User Story 12 - Rename a participant in the current game

- [x] T056 Add a host-only rename operation and inline rename UI for the current game-night participant, including validation, duplicate-name handling, snapshot updates, and E2E mock behavior in `supabase/migrations/008_undo_challenge_finish_and_rename_players.sql`, `supabase/functions/game-nights/participants.ts`, `supabase/functions/game-nights/index.ts`, `supabase/functions/game-nights/shared.ts`, `src/features/game-night/game-night-api.ts`, `src/features/game-night/HostControls.tsx`, `src/app/App.css`, and `tests/e2e/mock-backend.ts`.
- [x] T057 Document undo eligibility, history and timer behavior, current-game-only renaming, validation, and test scenarios in `specs/002-game-night-player-tools/spec.md`, `specs/002-game-night-player-tools/plan.md`, `specs/002-game-night-player-tools/research.md`, `specs/002-game-night-player-tools/data-model.md`, `specs/002-game-night-player-tools/contracts/game-night-api.md`, and `specs/002-game-night-player-tools/quickstart.md`.

### User Story 13 - Open a separate display-only board

- [x] T058 Add a display-only join option and host-provided standalone display link in `src/app/App.tsx`, `src/features/game-night/HostSetup.tsx`, and `src/features/game-night/GameNightPage.tsx`; ensure the display URL bypasses stored host-session restoration and always opens the live board in read-only widescreen mode.
- [x] T059 Add end-to-end coverage for display-only join, host-launched display in a second tab with saved host credentials, and suppression of mutation controls in `tests/e2e/live-game-night.spec.ts`.
- [x] T060 Document display-only join and separate-monitor behavior in `specs/002-game-night-player-tools/spec.md`, `specs/002-game-night-player-tools/quickstart.md`, and `deploy/unraid/README.md`.

## Phase 14: Global shared-content management

### User Story 14 - Manage shared content without a game night

- [x] T061 Add a protected global admin route with challenge add/edit/archive APIs and team-name pool list/add/edit/remove APIs in `supabase/functions/game-nights/admin.ts`, `supabase/functions/game-nights/challenges.ts`, `supabase/functions/game-nights/index.ts`, and `src/features/game-night/game-night-api.ts`.
- [x] T062 Add a service-role-only seeded team-name pool and use it for future generated teams, returning a clear error when empty, in `supabase/migrations/009_global_content_management.sql` and `supabase/functions/game-nights/teams.ts`.
- [x] T063 Add the standalone content-admin page and navigation, retaining the admin password only in page memory, in `src/features/admin/GlobalContentAdminPage.tsx`, `src/app/App.tsx`, and `src/app/App.css`.
- [x] T064 Configure strong server-only admin passwords for Unraid and local development in `deploy/unraid/prepare-supabase.sh`, `deploy/unraid/.env.example`, `deploy/unraid/supabase.override.yaml`, `scripts/start-local.mjs`, and `.env.example`.
- [x] T065 Add API integration coverage and E2E mock/UI scenarios for authentication, challenge archival, and team-name pool management without a game night in `tests/integration/admin.test.ts`, `tests/integration/setup.ts`, `tests/e2e/mock-backend.ts`, and `tests/e2e/live-game-night.spec.ts`.
- [x] T066 Document admin access, challenge archive/history semantics, and random team-name pool behavior in `specs/002-game-night-player-tools/spec.md`, `specs/002-game-night-player-tools/plan.md`, `specs/002-game-night-player-tools/research.md`, `specs/002-game-night-player-tools/data-model.md`, `specs/002-game-night-player-tools/contracts/game-night-api.md`, `specs/002-game-night-player-tools/quickstart.md`, and `deploy/unraid/README.md`.
---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; existing project setup is reused.
- **Foundational (Phase 2)**: Required before story work because participant/team/round snapshots and persistence depend on the additive schema.
- **User Stories (Phases 3-6)**: Each depends on the foundational phase. The story UI changes may be developed independently after the shared schema/types land.
- **Polish and later stories (Phases 7-12)**: Depend on the foundational phase; final verification follows the removal, catalog, and wide-screen work.

### User Story Dependencies

- **US1 (P1)**: Depends on foundational schema/types; otherwise independent.
- **US2 (P1)**: Depends on foundational schema/types; otherwise independent of US1.
- **US3 (P2)**: Depends on the shared participant snapshot; otherwise independent of US1 and US2.
- **US4 (P2)**: Depends on shared score/snapshot flow. Team-total verification is finalized with US3; the individual score submission can be tested independently.
- **US7 (P2)**: Depends on team assignments and player-scoped unfinished challenge rounds from US2 and US3.
- **US8 (P2)**: Depends on participant snapshots and player-scoped challenge rounds from US1 and US2.
- **US9 (P2)**: Depends on the shared challenge catalog and round snapshot from US2.
- **US10 (P2)**: Depends on active participant and challenge snapshots from US1 and US2.

### Parallel Opportunities

- T002 can proceed alongside T001; T003 follows both.
- Within each story, its integration/e2e test authoring tasks can proceed in parallel.
- After Phase 2, US1 and US2 are separate increments; US3 and US4 can be worked on in parallel after shared API types stabilize.
- T022 documentation reconciliation can run alongside final integration validation.

## Parallel Example: User Story 2

```text
Task: "Add integration coverage for participant-targeted unique draws and independent timers in tests/integration/game-night.test.ts"
Task: "Add end-to-end coverage for parallel player rounds in tests/e2e/challenge-timer.spec.ts"
```

## Implementation Strategy

### MVP First

1. Complete the foundational migration and snapshot/types.
2. Implement US1 and US2 as the core mid-game and per-player challenge experience.
3. Validate both stories with local Supabase integration tests and Playwright before continuing.

### Incremental Delivery

1. Add active-game player management (US1).
2. Add player-specific challenge rounds and timers (US2).
3. Add team assignments and derived totals (US3).
4. Add casual self-scoring and its disclosure (US4).
5. Run cross-cutting build, lint, regression, and quickstart checks.

## Notes

- Every task uses a checklist, sequential ID, story label where applicable, and concrete file paths.
- Database constraints and transactions remain authoritative; frontend checks are not sufficient for uniqueness or authorization.
- The shared spectator code is deliberately not treated as player identity verification.
