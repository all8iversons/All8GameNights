# Implementation Plan: Game Night Showdown

**Branch**: `001-game-night-showdown` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-game-night-showdown/spec.md`

## Summary

Build a React and TypeScript game-night website for one host and multiple live viewers. Use Supabase Postgres for durable game-night, participant, score, and challenge-round data; Supabase Realtime for prompt update notifications; and server-side Edge Functions for host-authorized state changes. Persist challenge draws with a database uniqueness constraint so no challenge can repeat during the same game night. Keep the host credential separate from the read-only spectator share code.

## Technical Context

**Language/Version**: TypeScript (current maintained version at implementation); React (current stable release)

**Primary Dependencies**: Vite for the web build; Supabase JavaScript client, Postgres, Realtime, and Edge Functions; Vitest and React Testing Library for unit/component tests; Playwright for end-to-end browser tests

**Storage**: Supabase Postgres for game-night history, scores, challenge catalog, and per-night challenge draws

**Testing**: Vitest + React Testing Library; Supabase local development stack for database/function integration tests; Playwright for primary host/viewer journeys

**Target Platform**: Modern desktop and mobile web browsers; a shared game display and viewers' devices

**Project Type**: Single web application with a React frontend and managed backend functions

**Performance Goals**: Meet the specification's target of displaying 95% of score changes to connected viewers within one second; challenge draw and timer start within 30 seconds of host action

**Constraints**: Internet connection required; one host controls a game night; anonymous/read-only viewing uses a spectator share code; host writes require a separate high-entropy capability; no credential or privileged database key may be shipped to the browser; repeated draws must be prevented transactionally, not just hidden in the UI

**Scale/Scope**: Hobby game nights with one active host-controlled event and multiple viewers; avoid commitments to enterprise-scale concurrency beyond the specified viewer update target

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan check | Status |
|---|---|---|
| Maintainable, Modular Architecture | Keep presentation, game-night domain behavior, persistence, and server-authorized mutations in clear boundaries. Use the database only where it enforces shared invariants. | Pass |
| Secure by Design | Treat host mutation access and spectator viewing as separate capabilities. Hash host capabilities at rest, validate them server-side, deny direct browser writes, apply least-privilege database policies, and keep privileged credentials out of client code. Collect only participant display names. | Pass |
| Verifiable Quality | Cover scoring, ties, timer state, challenge exhaustion, repeat-draw prevention, persistence, authorization, and failure cases with automated unit, integration, and browser tests. | Pass |
| Stable Integration Contracts | Define the client-to-function request/response contract, authorization, and error behavior before implementation. | Pass |
| Operational Readiness | Provide actionable UI errors and empty states, avoid logging credentials or unnecessary personal data, and measure score-update latency against the stated target. | Pass |

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/001-game-night-showdown/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── game-night-api.md
```

### Source Code (repository root)

```text
src/
├── app/
├── components/
├── features/
│   ├── game-night/
│   ├── challenge/
│   ├── timer/
│   └── history/
├── lib/
└── styles/

supabase/
├── functions/
├── migrations/
└── seed.sql

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Use one root-level React application with feature-oriented modules. Keep database migrations and server-side functions in the Supabase project directory; share API contracts through the feature documentation rather than coupling UI components directly to privileged database operations.
