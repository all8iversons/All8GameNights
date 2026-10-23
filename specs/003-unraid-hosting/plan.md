# Implementation Plan: Unraid Hosting

**Branch**: `003-unraid-hosting` (planned; current worktree remains on `main`) | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-unraid-hosting/spec.md`

## Summary

Package the existing React game-night application and the Supabase services it depends on as an Unraid-managed Docker Compose stack. Use Supabase's official self-hosted Docker deployment as the backend basis, managed in the Compose-Craft application already present on the operator's Unraid server. Keep PostgreSQL and all application volumes isolated from the operator's existing MariaDB/MySQL service. Provide persistent storage, protected configuration, health visibility, and tested backup/restore guidance.

## Technical Context

**Language/Version**: Existing React 19, TypeScript 5.8, and Node.js LTS frontend; Linux containers for deployment.

**Primary Dependencies**: Existing Vite-built web app; official Supabase self-hosted Docker Compose stack, including PostgreSQL, API gateway, Auth, PostgREST, Realtime, and Edge Runtime; Docker Compose; Compose-Craft or compatible Unraid Compose manager.

**Storage**: A dedicated Supabase PostgreSQL data volume and any other enabled Supabase persistent volumes, each mapped to a dedicated Unraid appdata path. Do not reuse or modify the existing MariaDB/MySQL container, database, credentials, or data paths.

**Testing**: Existing `npm run build`, `npm run lint`, `npm test`, `npm run test:integration`, and `npm run test:e2e`; Compose configuration validation; deployment smoke, restart, port-conflict, and backup/restore validation on an Unraid test instance.

**Target Platform**: Unraid server running Linux containers and Compose-Craft, on a CPU architecture supported by the pinned upstream Supabase and application images.

**Project Type**: Existing React web application with Supabase backend, extended with a server deployment package and operator documentation.

**Performance Goals**: Meet the specification's install, restart, and restore targets on a supported server; preserve existing game-night behavior and live updates for local-network clients.

**Constraints**: Self-host required Supabase services; do not depend on hosted Supabase. Preserve existing application capabilities and PostgreSQL schema. Use dedicated persistent paths, generated non-default secrets, and health checks. Do not publish PostgreSQL, internal services, or Studio for general network access. Account for Unraid host-port conflicts. Self-hosting requires operator-managed updates, backups, security, and recovery. The existing MariaDB/MySQL service is out of scope and must remain unchanged.

**Scale/Scope**: One Unraid-hosted game-night installation for the operator's household/local-network users. No multi-tenant hosting, public internet requirement, MariaDB migration, or changes to game-night product behavior.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Plan compliance |
|---|---|
| Maintainable, modular architecture | Use a separate `deploy/unraid/` deployment package; keep application UI and existing Supabase function boundaries intact; track a pinned upstream self-hosted stack rather than translating its services into unrelated app templates. |
| Secure by design | Generate non-default service keys; keep secrets out of version control and browser configuration; publish only required user-facing ports; restrict database, Studio, and internal service access; document trusted-network and HTTPS/reverse-proxy options. |
| Verifiable quality | Run existing build, lint, unit, integration, and browser tests; validate the Compose configuration and actual install, lifecycle, persistence, and recovery on Unraid. |
| Stable integration contracts | Keep the existing browser-to-Supabase API, function, and Realtime behavior. Define deployment configuration, published endpoints, and persistent paths explicitly; do not change database engine or alter the operator's MariaDB. |
| Operational readiness | Provide service health visibility, actionable logs, persistent storage mapping, update/rollback guidance, and tested backups/restores for PostgreSQL and other enabled data volumes. |
| Enterprise constraints and delivery workflow | Do not commit credentials; use maintained pinned upstream images; document update/security ownership and compatibility; require review and automated quality gates before release. |

**Gate result**: PASS. No constitution exceptions are required. Remaining implementation details such as the exact image versions and host-port defaults are resolved during implementation using the selected upstream release and Unraid host availability, without changing the architectural decisions below.

## Project Structure

### Documentation (this feature)

```text
specs/003-unraid-hosting/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── deployment.md
```

### Source Code (repository root)

```text
deploy/
└── unraid/
    ├── compose.yaml
    ├── .env.example
    ├── prepare-supabase.sh
    ├── supabase.override.yaml
    ├── nginx.conf
    ├── entrypoint.sh
    ├── scripts/
    │   ├── migrate.sh
    │   ├── backup.sh
    │   └── restore.sh
    └── README.md
Dockerfile
public/
└── runtime-config.js
src/
├── lib/
│   └── config.ts
└── features/
supabase/
├── config.toml
├── functions/
└── migrations/
tests/
├── e2e/
├── integration/
├── unit/
└── deploy/
    └── unraid/
        └── backup-restore.test.mjs
```

**Structure Decision**: Keep the existing frontend, Supabase functions, migrations, and tests in place. Add the Unraid Compose stack and operator-facing deployment instructions under `deploy/unraid/`; add a root Dockerfile to package the existing web application. The frontend must consume its public Supabase URL and publishable key at container runtime so operators can configure their LAN address without rebuilding the image. The Compose definition uses dedicated Supabase appdata paths and does not attach to or mount the existing MariaDB container.

## Design Decisions

- Use the official self-hosted Supabase Compose deployment as the source of truth for service topology and required settings. Pin a compatible upstream release and document how to review upstream changes before updating it.
- Manage the stack as a Compose project through Compose-Craft, already visible in the operator's screenshot. Installation instructions may name a compatible Compose manager as an alternative, but the supported path is the existing Compose-Craft experience rather than individual container templates.
- Publish only the frontend and Supabase API gateway on configurable Unraid host ports. Keep PostgreSQL, Studio, and internal service ports unexposed to the LAN; users access supported APIs and Realtime WebSockets through the gateway.
- Separate public browser configuration (runtime API URL and publishable key) from server-only service secrets. Keep `.env` configuration in the deployment's restricted appdata location, exclude it from version control, and use generated secrets rather than upstream defaults.
- Store PostgreSQL and other enabled persistent service data under distinct, named appdata directories. Treat the existing MariaDB/MySQL service, data, and HeidiSQL setup as independent and unchanged.
- Back up PostgreSQL with a database-aware dump and separately include any enabled Storage files, persistent application configuration, and required secrets. Restore into a stopped or fresh compatible stack, verify records, and retain the pre-update backup for rollback.
- Implement frontend runtime configuration and service health checks rather than baking a server-specific URL into the image or relying only on a container's running status.

## Constitution Check (Post-Design)

| Review | Result |
|---|---|
| Secret handling and least exposure | PASS — browser receives only public settings; server secrets remain server-side; database and internal service ports are not published. |
| Stable interfaces and external dependencies | PASS — existing app-facing Supabase behavior remains stable; upstream service version is pinned and its required public routes are documented. |
| Persistence, diagnostics, and recovery | PASS — data locations, health checks, logs, database-aware backup/restore, and update recovery are part of the design. |
| Automated verification | PASS — existing project checks and Unraid-specific lifecycle, network, and recovery scenarios are included. |
| Unrelated existing services | PASS — no MariaDB/MySQL configuration, schema, credentials, container, or data path is modified. |

**Post-design gate result**: PASS. No exceptions or unresolved design clarifications remain.
