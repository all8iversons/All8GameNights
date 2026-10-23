# Tasks: Unraid Hosting

**Input**: Design documents from `specs/003-unraid-hosting/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/deployment.md`, `quickstart.md`

**Organization**: Tasks are grouped by user story for independently verifiable delivery. Automated validation tasks are included to meet the project's constitution requirements.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase; uses different files and has no incomplete task dependency.
- **[Story]**: User story from `spec.md` (US1, US2, US3).
- Every task names its implementation or validation file path.

## Phase 1: Setup

**Purpose**: Prepare the repository for containerized deployment without including local credentials or build artifacts.

- [X] T001 Add Docker build exclusions for dependencies, local environment files, and generated output in `.dockerignore`.
- [X] T002 [P] Add deployment-local ignore rules for populated environment files and backup artifacts in `deploy/unraid/.gitignore`.

## Phase 2: Foundational

**Purpose**: Establish the pinned backend stack and shared deployment configuration required by all user journeys.

- [X] T003 Record the selected official Supabase self-hosted release and its upstream source, required services, and Compose-Craft import assumptions in `deploy/unraid/README.md`.
- [X] T004 Define the pinned Supabase service topology, private internal network, configurable frontend/API gateway host ports, service startup dependencies, and dedicated persistent appdata mounts in `deploy/unraid/compose.yaml`.
- [X] T005 Add documented placeholder values for required Supabase secrets, public URLs, allowed origin, ports, and persistent paths in `deploy/unraid/.env.example`; ensure no real credentials or upstream default secrets are included.

**Checkpoint**: The deployment's shared backend topology and configuration contract are ready; user-story work can proceed.

## Phase 3: User Story 1 - Install and access the application (Priority: P1)

**Goal**: Install the application and its backend services through Compose-Craft, then use the game-night experience from another device on the local network without hosted Supabase.

**Independent Test**: On a supported Unraid test server, import and start the configured Compose stack, open the frontend from another LAN device, complete a game-night flow, and confirm a spectator receives live updates.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create a multi-stage production frontend image that builds the existing React app and serves its static output in `Dockerfile`.
- [X] T007 [US1] Add the static web server configuration and startup entrypoint that generate browser-safe runtime settings from the public Supabase URL and publishable key in `deploy/unraid/nginx.conf` and `deploy/unraid/entrypoint.sh`.
- [X] T008 [US1] Add automated coverage for missing, malformed, and valid runtime configuration, including verification that privileged credentials are not read by the frontend, in `tests/unit/config/runtime-config.test.ts`.
- [X] T009 [P] [US1] Update the frontend configuration resolver to prefer validated runtime settings while preserving local Vite environment configuration in `src/lib/config.ts` and `src/vite-env.d.ts`.
- [X] T010 [US1] Add the built frontend service, gateway routing, and existing migration/seed initialization to the stack in `deploy/unraid/compose.yaml`; ensure migrations are applied without resetting persistent data on restart.
- [X] T011 [US1] Document prerequisites, generated secrets, Compose-Craft import, LAN address/port configuration, first startup, and troubleshooting in `deploy/unraid/README.md`.

**Checkpoint**: The operator can install the stack and complete the existing game-night experience from another LAN device.

## Phase 4: User Story 2 - Manage the application lifecycle (Priority: P2)

**Goal**: Start, stop, restart, inspect, and update the deployment through Compose-Craft while preserving its data and reporting failures clearly.

**Independent Test**: With an installed test stack and a completed game-night record, stop and restart through Compose-Craft, confirm health and record persistence, then verify that an unavailable required service is visible as unhealthy.

### Implementation for User Story 2

- [X] T012 [US2] Add service-specific health checks, dependency startup conditions, and useful failure status for the frontend and required Supabase services in `deploy/unraid/compose.yaml`.
- [X] T013 [US2] Document Compose-Craft start, stop, restart, log inspection, unhealthy-service diagnosis, and recovery steps in `deploy/unraid/README.md`.
- [X] T014 [US2] Document compatible pinned-version updates, pre-update backup requirements, and rollback steps that preserve persistent mounts in `deploy/unraid/README.md`.
- [X] T015 [P] [US2] Add lifecycle, health, and 10-cycle persistence checks to `specs/003-unraid-hosting/quickstart.md`.

**Checkpoint**: Compose-Craft lifecycle operations return the application to a healthy state without losing saved game-night records.

## Phase 5: User Story 3 - Protect and recover application data (Priority: P2)

**Goal**: Back up the PostgreSQL database, enabled file-storage data, and required configuration, then restore and verify them without overwriting a live database.

**Independent Test**: Create a game-night record on a test stack, produce a backup, restore it into a stopped or fresh compatible test stack, and verify the record and required files are available.

### Implementation for User Story 3

- [X] T016 [P] [US3] Create a backup script that writes `manifest.json`, a database-aware PostgreSQL dump, enabled file-storage data, and protected configuration/secrets into one timestamped archive in `deploy/unraid/scripts/backup.sh`.
- [X] T017 [P] [US3] Create a restore script that validates the shared `manifest.json` and archive contents, requires a compatible stopped stack, and refuses unsafe overwrite of a live database in `deploy/unraid/scripts/restore.sh`.
- [X] T018 [US3] Add automated backup/restore script checks for missing paths, invalid archives, stopped-stack requirements, and successful test restoration in `tests/deploy/unraid/backup-restore.test.mjs`.
- [X] T019 [US3] Document backup contents, access-controlled backup handling, restore prerequisites, restore verification, and separation from the existing MariaDB/MySQL paths in `deploy/unraid/README.md`.

**Checkpoint**: An operator can recover saved game-night data and configuration using the documented backup and restore workflow.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Make the deployment discoverable and verify the complete feature against its acceptance criteria.

- [X] T020 Add an Unraid deployment section linking to the operator guide and clarifying that the existing MariaDB/MySQL service is unchanged in `README.md`.
- [ ] T021 Run and resolve failures from the existing build, lint, unit, integration, and end-to-end checks in `package.json` and affected files under `src/`, `tests/`, and `deploy/unraid/`.
- [ ] T022 Execute the Compose configuration, LAN install, port exposure, restart/persistence, failure, and backup/restore scenarios and record observed results in `specs/003-unraid-hosting/quickstart.md`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; prepares container context and local secret exclusions.
- **Foundational (Phase 2)**: Depends on Setup; establishes the backend stack and operator configuration required by every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers the installable LAN-accessible application and backend.
- **User Story 2 (Phase 4)**: Depends on User Story 1's installable stack; adds and validates lifecycle and health operations.
- **User Story 3 (Phase 5)**: Depends on User Story 1's persistent database and file paths; adds and validates recovery operations. It can proceed in parallel with User Story 2 after User Story 1 is complete.
- **Polish (Phase 6)**: Depends on all three desired user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependency on another story.
- **User Story 2 (P2)**: Requires the Compose stack and installed services from US1.
- **User Story 3 (P2)**: Requires the persistent Supabase services from US1; independent of US2.

### Within Each User Story

- Complete runtime configuration before runtime-configuration tests.
- Complete the initial Compose deployment before adding lifecycle health checks.
- Complete persistent mount definitions before backup and restore scripts.
- Complete scripts before backup/restore verification and final operator documentation.

### Parallel Opportunities

- **Setup**: T001 and T002 touch separate files.
- **Foundational**: T003 documents upstream assumptions; T004 defines Compose topology; T005 defines sample values. Run sequentially where the documentation must reflect the selected topology.
- **US1**: T006 may proceed in parallel with initial documentation in T011; T007 and T008 are separate implementation files; T009 follows T008; T010 integrates the image and gateway after T006–T008.
- **US2**: T015 can be drafted in parallel with T012; T013 and T014 update the same README and should be combined or applied sequentially.
- **US3**: T016 and T017 use separate scripts and may be developed in parallel once T004's persistent paths are fixed; T018 follows both scripts; T019 follows the resulting backup/restore contract.
- **Across stories**: US2 and US3 can proceed in parallel after US1.

## Parallel Example: User Story 1

```text
After Foundational is complete:
Task: T006 Build the frontend image in Dockerfile
Task: T008 Add runtime configuration support in src/lib/config.ts
```

## Parallel Example: User Story 2

```text
After US1 is complete:
Task: T012 Add health checks in deploy/unraid/compose.yaml
Task: T015 Add lifecycle scenarios in specs/003-unraid-hosting/quickstart.md
```

## Parallel Example: User Story 3

```text
After US1 is complete:
Task: T016 Create deploy/unraid/scripts/backup.sh
Task: T017 Create deploy/unraid/scripts/restore.sh
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Complete US1 to provide the Compose-Craft installation, runtime-configured frontend, and self-hosted Supabase stack.
3. Validate the full game-night flow from a second LAN device.
4. Stop at the US1 checkpoint only for a private test deployment; complete lifecycle and recovery stories before relying on the deployment for persistent data.

### Incremental Delivery

1. Deliver and validate US1 installation and access.
2. Add US2 lifecycle health, update, and rollback procedures.
3. Add US3 backup and restore.
4. Complete polish checks and the full Unraid quickstart before considering the feature production-ready.

### Task Count

- Setup: 2
- Foundational: 3
- US1: 6
- US2: 4
- US3: 4
- Polish: 3
- **Total: 22 tasks**
