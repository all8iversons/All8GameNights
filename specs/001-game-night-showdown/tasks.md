---
description: 'Implementation task list for Game Night Showdown'
---

# Tasks: Game Night Showdown

**Input**: Design documents in `specs/001-game-night-showdown/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/game-night-api.md`, `quickstart.md`

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an increment. Automated test tasks are included to meet the project constitution's verifiable-quality requirement.

**Task format**: `- [ ] T### [P?] [US#?] Description with file path`

## Phase 1: Setup

**Purpose**: Initialize the single React/TypeScript application and its quality gates.

- [x] T001 Create the React and TypeScript Vite application with `package.json`, `index.html`, and `src/main.tsx` at the repository root.
- [x] T002 [P] Configure TypeScript, Vite, linting, formatting, Vitest, React Testing Library, and Playwright in `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, and `playwright.config.ts`.
- [x] T003 [P] Add environment-variable examples and ignore local secrets in `.env.example` and `.gitignore`; document that privileged Supabase credentials and host capabilities must not be committed.

## Phase 2: Foundational

**Purpose**: Establish secure shared persistence and common application contracts that block all story implementation.

- [x] T004 Initialize the local Supabase configuration and database migration/seed workflow in `supabase/config.toml` and `supabase/seed.sql`.
- [x] T005 [P] Create the shared game-night and participant schema in `supabase/migrations/001_game_nights.sql` with `setup`, `active`, and `completed` statuses; store `created_at`, nullable `started_at` and `completed_at`; require trimmed non-empty participant names, reject case/whitespace-insensitive duplicate names per night, and initialize integer scores to zero.
- [x] T006 Implement capability generation, hashing, and constant-time verification helpers in `supabase/functions/_shared/capabilities.ts`; keep host and spectator capabilities distinct, persist only hashes, and never log capability values.
- [x] T007 Implement shared Edge Function request parsing, authorization, validation errors, and structured error responses in `supabase/functions/_shared/http.ts` and `supabase/functions/_shared/game-night-auth.ts`; require host capability for mutations and deny writes for completed nights.
- [x] T008 Define shared TypeScript game-night, participant, timer, and API response types in `src/features/game-night/types.ts` and `src/lib/api-types.ts`.
- [x] T009 Implement the browser API client and safe environment configuration in `src/lib/api-client.ts` and `src/lib/config.ts`; route all writes through server functions and never expose service credentials.
- [x] T010 Create the accessible application shell in `src/app/App.tsx` and `src/app/App.css`, and reusable loading, empty, and error states in `src/components/`.
- [x] T011 [P] Add automated unit-test conventions and a local Supabase integration-test harness in `tests/unit/setup.ts` and `tests/integration/setup.ts`.

**Checkpoint**: The project builds, the local database can be reset, common API/auth behavior exists, and story work can proceed.

## Phase 3: User Story 1 - Run a live game night (Priority: P1) 🎯 MVP

**Goal**: A host creates a game night, adds participants, starts play, and updates scores while all viewers see current standings and ties.

**Independent Test**: Create a night, add at least two participants, start it, update scores, and verify a separate spectator view displays current scores and equal ranks for tied participants.

### Tests for User Story 1

- [x] T012 [P] [US1] Add unit tests for participant-name validation, score deltas, ranking, and tied-rank behavior in `tests/unit/game-night.test.ts`.
- [x] T013 [P] [US1] Add Supabase integration tests for night creation, participant setup, start requirements, atomic score updates, spectator read access, and host-only writes in `tests/integration/game-night.test.ts`.
- [x] T014 [P] [US1] Add a browser journey for creating a night, adding two players, starting play, changing scores, and observing tied/current standings from another browser context in `tests/e2e/live-game-night.spec.ts`.

### Implementation for User Story 1

- [x] T015 [P] [US1] Implement game-night creation and participant-add Edge Functions in `supabase/functions/game-nights/index.ts` and `supabase/functions/game-nights/participants.ts`; create nights in `setup`, return separate one-time host and spectator capabilities, and initialize each participant's score to zero.
- [x] T016 [US1] Implement the start-game-night Edge Function in `supabase/functions/game-nights/start.ts`; require at least one participant and transition the night from `setup` to `active` with `started_at`.
- [x] T017 [US1] Implement the score-update Edge Function in `supabase/functions/game-nights/score.ts`; accept only non-zero integer deltas, update the score atomically, and ensure retries with the same idempotency key do not apply a delta twice.
- [x] T018 [US1] Implement spectator snapshot reads and payload-free, transaction-triggered state-change notifications in `supabase/functions/game-nights/read.ts` and `supabase/migrations/001_game_nights.sql`; make the database authoritative and refresh snapshots after notification and reconnect.
- [x] T019 [P] [US1] Build the host setup flow for creating a night, adding named participants, displaying/storing the host capability safely for the host session, and sharing a separate read-only spectator code in `src/features/game-night/HostSetup.tsx`.
- [x] T020 [P] [US1] Build the active game-show scoreboard with participant scores, shared rankings, visible ties, and responsive spectator display in `src/features/game-night/Scoreboard.tsx` and `src/features/game-night/scoreboard.css`.
- [x] T021 [US1] Connect host score controls and participant management to the game-night API in `src/features/game-night/HostControls.tsx` and `src/features/game-night/game-night-api.ts`; show pending, success, and explicit failure states without optimistic success on rejected writes.
- [x] T022 [US1] Implement live spectator subscriptions, coalesced snapshot refresh, initial load, and reconnect recovery in `src/features/game-night/useLiveGameNight.ts`.
- [x] T023 [US1] Add accessible empty, loading, invalid-code, offline, and empty-roster messaging for the live game flow in `src/features/game-night/GameNightPage.tsx`.

**Checkpoint**: User Story 1 works independently; score changes appear to viewers within the specified one-second target under the agreed test conditions.

## Phase 4: User Story 2 - Run a timed video game challenge (Priority: P2)

**Goal**: A host randomly draws an unused precreated challenge for the current night and controls a shared, persistent timer.

**Independent Test**: Start a night, draw challenges until exhaustion while confirming no repeat, then start, pause, resume, reset, and expire a timer while viewers see its state.

### Tests for User Story 2

- [x] T024 [P] [US2] Add unit tests for timer transitions, deadline-derived remaining time, invalid durations, and expiry behavior in `tests/unit/challenge-timer.test.ts`.
- [x] T025 [P] [US2] Add Supabase integration tests for challenge seeding, concurrent draw requests, per-night uniqueness, idempotent retries, challenge-pool exhaustion, and timer state transitions in `tests/integration/challenges.test.ts`.
- [x] T026 [P] [US2] Add a browser journey for challenge display, draw-without-replacement, no-unused-challenges state, and shared timer controls in `tests/e2e/challenge-timer.spec.ts`.

### Implementation for User Story 2

- [x] T027 [US2] Create the challenge catalog and challenge-round schema in `supabase/migrations/002_challenges.sql` and `supabase/seed.sql`; require non-empty challenge names/instructions, mark draw-eligible entries enabled, and enforce uniqueness on `(game_night_id, challenge_id)`.
- [x] T028 [US2] Implement the atomic challenge draw Edge Function in `supabase/functions/game-nights/draw-challenge.ts`; serialize draws per night, select only enabled unused challenges, persist the draw in the same transaction, stop a running prior timer, and return `NO_UNUSED_CHALLENGES` when exhausted.
- [x] T029 [US2] Implement timer state and server-authoritative deadline transitions in `supabase/functions/game-nights/challenge-timer.ts`; allow `ready`, `running`, `paused`, `expired`, and `stopped`, require positive integer durations, and implement start, pause, resume, and reset behavior.
- [x] T030 [P] [US2] Build the challenge card and host draw controls showing challenge name/instructions and a clear exhausted-pool state in `src/features/challenge/ChallengePanel.tsx`.
- [x] T031 [P] [US2] Build the shared countdown display and host start, pause, resume, and reset controls in `src/features/timer/ChallengeTimer.tsx` and `src/features/timer/timer.css`; derive displayed time from the authoritative deadline instead of treating a browser interval as the source of truth.
- [x] T032 [US2] Integrate challenge draw and timer endpoints into the active game-night page in `src/features/challenge/challenge-api.ts` and `src/features/game-night/GameNightPage.tsx`; refresh viewers from authoritative state and show validation/network errors.

**Checkpoint**: User Story 2 works independently on an active night and a challenge cannot repeat before a new night begins.

## Phase 5: User Story 3 - Review previous game-night winners (Priority: P2)

**Goal**: The host completes a night, saving immutable final scores and all winners; users can review completed events in newest-first order.

**Independent Test**: Complete a night with a unique winner, then complete another with tied winners; reload the app and verify the leaderboard preserves event dates, scores, and all winners in newest-first order.

### Tests for User Story 3

- [x] T033 [P] [US3] Add unit tests for winner derivation, tied winners, and newest-first event ordering in `tests/unit/leaderboard.test.ts`.
- [x] T034 [P] [US3] Add Supabase integration tests for completion, score immutability, idempotent completion, empty history, tied winner derivation, and persistent historical results in `tests/integration/leaderboard.test.ts`.
- [x] T035 [P] [US3] Add a browser journey for completing an event, viewing unique/tied winners, reopening the history page, and showing an empty-history state in `tests/e2e/leaderboard.spec.ts`.

### Implementation for User Story 3

- [x] T036 [US3] Implement atomic, idempotent game-night completion in `supabase/functions/game-nights/complete.ts`; require at least one participant, freeze final scores, set `completed_at`, and reject later mutations.
- [x] T037 [US3] Implement the historical leaderboard read function in `supabase/functions/leaderboard/index.ts`; return completed nights newest first with final participant results and every participant tied at the highest score.
- [x] T038 [P] [US3] Build the historical leaderboard and its no-results state in `src/features/history/LeaderboardPage.tsx` and `src/features/history/leaderboard.css`.
- [x] T039 [US3] Add host completion confirmation and result display to the active game-night UI in `src/features/game-night/CompleteGameNight.tsx`; display tied winners and prevent edits after completion.

**Checkpoint**: User Story 3 works independently using persisted game-night results, including ties and empty history.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete user-facing quality, accessibility, security, and end-to-end validation across stories.

- [x] T040 [P] Add keyboard navigation, visible focus, semantic live announcements for score/timer updates, and responsive layout checks across `src/app/`, `src/components/`, and `src/features/`.
- [x] T041 [P] Review database grants, row-level security, Edge Function authorization, rate limits, capability handling, CORS, and secret-safe diagnostics in `supabase/migrations/`, `supabase/functions/`, and `.env.example`.
- [x] T042 Add deployment/configuration and host/spectator usage guidance in `README.md`, including capability handling, local setup, catalog seeding, and result-retention behavior.
- [ ] T043 Run the complete local validation flow in `specs/001-game-night-showdown/quickstart.md`, record score-update latency evidence, and fix any failures in the implicated `src/`, `supabase/`, or `tests/` files. **Blocked:** Docker and Supabase CLI are unavailable, so the local database-backed flow and latency evidence could not be run.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; must complete before foundation.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; provides the MVP active-game and scoreboard flow.
- **User Story 2 (Phase 4)**: Depends on Foundational and the active-night API/types from US1 (T016, T018); then its challenge and timer work can proceed.
- **User Story 3 (Phase 5)**: Depends on Foundational and active-night lifecycle/score behavior from US1 (T016, T017); does not depend on US2.
- **Polish (Phase 6)**: Depends on the user stories selected for delivery; final quickstart validation depends on all three.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on another user story. MVP.
- **US2 (P2)**: Needs the active-game lifecycle and common viewer state from US1, but can be developed independently after those interfaces are available.
- **US3 (P2)**: Needs the active-game lifecycle and final participant scores from US1; independent of US2.
- **US2 and US3**: Can proceed in parallel after shared US1 interfaces and Phase 2 are complete.

### Within Each User Story

- Automated test tasks are included to satisfy the constitution and should be completed with the behavior they verify.
- Schema and server-side invariants precede the UI that relies on them.
- Host mutations require authorization and validation in the server-side function, not only in the client.
- Complete one story checkpoint before integrating dependent story work.

## Parallel Execution Examples

### Setup and foundational work

```text
After T001: T002 and T003 can proceed in parallel.
After T004: T005 and T006 can proceed in parallel.
After T008: T009 and T010 can proceed in parallel.
```

### User Story 1

```text
After the shared schema and API types are ready:
- T012, T013, and T014 can be developed in parallel.
- T019 and T020 can be developed in parallel.
T016 and T017 depend on shared host authorization; T021 depends on the score endpoint and T020.
```

### User Story 2

```text
After US1 active-night interfaces are available:
- T024, T025, and T026 can be developed in parallel.
- T030 and T031 can be developed in parallel after the challenge/timer contract is agreed.
T028 and T029 depend on T027; T032 depends on the server functions and UI.
```

### User Story 3

```text
After US1 completion prerequisites are available:
- T033, T034, and T035 can be developed in parallel.
- T037 and T038 can be developed in parallel after result shape agreement.
T039 depends on T036 and T037.
```

## Implementation Strategy

1. Finish Setup and Foundational tasks before story implementation.
2. Deliver **US1 alone as the MVP**: host setup, live scoreboard, and score control with verified spectator updates.
3. Add US2 challenge draw and timer, preserving the database-enforced once-per-night selection rule.
4. Add US3 completion and persistent historical results.
5. Complete cross-cutting accessibility, security, documentation, and quickstart validation.

## Format Validation

- All implementation tasks use `- [ ] T###`.
- User-story tasks carry the corresponding `[US1]`, `[US2]`, or `[US3]` label.
- `[P]` is used only for tasks with separable files/work and no unmet dependency.
- Every task description names the file path or paths to create or modify.
