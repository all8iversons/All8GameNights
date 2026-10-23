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

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; existing project setup is reused.
- **Foundational (Phase 2)**: Required before story work because participant/team/round snapshots and persistence depend on the additive schema.
- **User Stories (Phases 3-6)**: Each depends on the foundational phase. The story UI changes may be developed independently after the shared schema/types land.
- **Polish (Phase 7)**: Depends on all selected stories being implemented.

### User Story Dependencies

- **US1 (P1)**: Depends on foundational schema/types; otherwise independent.
- **US2 (P1)**: Depends on foundational schema/types; otherwise independent of US1.
- **US3 (P2)**: Depends on the shared participant snapshot; otherwise independent of US1 and US2.
- **US4 (P2)**: Depends on shared score/snapshot flow. Team-total verification is finalized with US3; the individual score submission can be tested independently.
- **US7 (P2)**: Depends on team assignments and player-scoped unfinished challenge rounds from US2 and US3.

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
