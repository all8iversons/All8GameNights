# Implementation Plan: Game Night Player Tools

**Branch**: `002-game-night-player-tools` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-game-night-player-tools/spec.md`

## Summary

Support mid-game roster changes, player-assigned unique challenges with independent timers, team assignments and derived team totals, balanced team randomization, host-configured team generation, six-digit join codes, and casual player-submitted score changes. Extend the existing Supabase-backed game-night snapshot and host-authorized mutation flow; add a deliberately join-code-authorized score endpoint with clear disclosure and request validation. Keep individual scores authoritative so standings, teams, and existing historical results stay consistent.

## Technical Context

**Language/Version**: TypeScript 5.8; React 19; Deno Edge Functions

**Primary Dependencies**: Existing Vite/React frontend, Supabase Postgres, Realtime, Edge Functions, Vitest, React Testing Library, and Playwright

**Storage**: Supabase Postgres; additive migration to associate players with teams and challenge rounds with players

**Testing**: Focused Vitest unit tests, local Supabase function/database integration tests, Playwright end-to-end flow, TypeScript build, and ESLint

**Target Platform**: Modern desktop and mobile web browsers with the existing local and hosted Supabase environments

**Project Type**: Single web application with server-side Edge Functions and a relational database

**Performance Goals**: 95% of accepted score changes appear to connected viewers within one second; a player can be added to the board within 10 seconds

**Constraints**: Preserve existing host capability authorization, read-only viewer behavior except for the explicitly chosen casual score submission, completed-night immutability, challenge uniqueness per night, durable timers, and existing history compatibility. Rate-limit invalid join-code attempts and public score changes because the six-digit code is low entropy. Do not expose privileged service credentials to the browser.

**Scale/Scope**: Game-night-sized rosters and one shared event; independent concurrent challenge rounds are limited to one unfinished round per player.

## Constitution Check

| Principle                          | Plan check                                                                                                                                                                                                                                                                                                                                                                   | Status                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Maintainable, Modular Architecture | Extend existing feature modules, Edge Function handlers, shared snapshot mapping, and migrations; keep team totals derived from individual scores.                                                                                                                                                                                                                           | Pass                                  |
| Secure by Design                   | Keep host mutations protected. The user explicitly chooses shared-code/name score submission for casual play; disclose that possession of the spectator code permits score changes under any participant name. Validate all inputs, enforce active-night and participant membership server-side, rate-limit public mutations, and do not expose host or service credentials. | Pass with documented product tradeoff |
| Verifiable Quality                 | Add regression coverage for mid-game additions, concurrent per-player challenge/timer isolation, unique draws, teams, public scoring, invalid inputs, and completed-night rejection.                                                                                                                                                                                         | Pass                                  |
| Stable Integration Contracts       | Specify additive request/response behavior for player, team, challenge, timer, and score operations; preserve existing endpoint consumers.                                                                                                                                                                                                                                   | Pass                                  |
| Operational Readiness              | Make save failures visible; treat database state as authoritative; refresh snapshots after reconnection; retain existing realtime notifications for each mutation.                                                                                                                                                                                                           | Pass                                  |

The casual shared-code scoring model is an intentional user-selected tradeoff, not identity verification. Its impersonation risk must remain explicit in the UI and API documentation.

## Project Structure

### Documentation (this feature)

```text
specs/002-game-night-player-tools/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── game-night-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── game-night/       # roster, team, player-scoped round UI and API
│   ├── challenge/        # player challenge assignment controls
│   └── timer/            # independent round timers
└── lib/                  # shared request and response types

supabase/
├── functions/
│   └── game-nights/      # validation, host/player authorization, snapshot mapping
└── migrations/           # additive team and player-round schema and RPC changes

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Keep the existing single React application and Supabase project. Add no new runtime service. Introduce an additive migration and extend current API handlers/types and player/team/challenge display components in their established locations.

## Implementation Decisions

- Store team membership on participants and compute team totals from participant scores; no independently mutable team score can drift from individual scores.
- Store the assigned participant on each challenge round. Enforce one unfinished round per player and one draw of each challenge per game night with database constraints/transactions.
- Add an explicit `finish` round action separate from timer reset. Resetting the timer alone does not release a player's active round.
- Keep timer state and deadlines on each challenge round. Timer requests identify the player's round, so parallel players do not overwrite each other.
- Allow room-code holders to trade unfinished challenge assignments between same-team players; reject running timers and make retries idempotent.
- Keep host-only mutations bearer-authorized. Player score changes use the spectator code as a shared, low-assurance capability, reject completed events and unknown participants, validate integer deltas, and apply updates atomically with idempotency.
- Generate new six-digit join codes with cryptographic randomness and collision retries while retaining compatibility with existing long codes. Count invalid lookups per source IP and rate-limit them; keep the separate high-entropy host capability for host operations.
- Randomize all current players into existing teams through a single host-authorized database operation, assigning team sizes that differ by at most one.
- Allow the host to generate a requested number of teams or set a maximum players-per-team capacity. Generate unique original space-themed names and replace the existing teams and assignments atomically, preserving individual scores.
- Reuse the current snapshot refresh and realtime notification path for participants, teams, scores, and challenge rounds.
- Retain current individual winner history. Team totals appear in the active board; expanding historical leaderboard records with team winners is outside this feature's specified scope.

## Complexity Tracking

No constitution violations require an exception. The shared spectator-code scoring tradeoff is documented and user-selected.
