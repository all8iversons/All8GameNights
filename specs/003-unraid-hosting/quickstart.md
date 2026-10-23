# Quickstart: Validate Unraid Hosting

This guide defines the planned end-to-end validation for the Unraid deployment. Run server scenarios on a non-production test stack or after making a verified backup. Do not use the existing MariaDB/MySQL data paths for this application.

## Prerequisites

- An Unraid server with Docker enabled, available appdata storage, and Compose-Craft or a compatible Compose manager.
- Supabase's documented minimum resources (4 GB RAM, 2 CPU cores, 40 GB SSD); 8 GB RAM, 4 CPU cores, and 80 GB SSD or more are recommended. Account for the server's other workloads.
- Available LAN host ports for the frontend and Supabase API gateway.
- A modern browser on another device on the same network.
- Node.js LTS and npm for repository-side validation.

## Validate the application before deployment

From the repository root:

```text
npm ci
npm run build
npm run lint
npm test
npm run test:deployment
npm run test:integration
npm run test:e2e
```

Expected result: build, lint, unit, integration, and browser checks pass. Integration tests require a running local Supabase stack and its local public settings; the project's documented local setup may be used for this check. No production secrets are used.

## Validate and install the Unraid stack

1. Review the pinned upstream Supabase release and the requirements in [deployment contract](contracts/deployment.md).
2. Copy the example environment configuration to a protected local configuration file. Generate unique non-default secrets; set the public application origin, API gateway URL, and available host ports. Do not commit the populated file.
3. Set dedicated Unraid appdata locations for PostgreSQL and any enabled Supabase file-storage data. Confirm that no path points to the existing MariaDB/MySQL container or data.
4. In Compose-Craft, import the deployment's Compose project and select the protected configuration file.
5. Validate the Compose configuration in the Compose manager. Confirm the frontend and gateway host ports are available and that database, Studio, and internal service ports are not published.
6. Start the stack and wait for all required health checks to pass. Review service status and logs if any dependency is unhealthy.
7. Open the configured frontend address from a second LAN device. Start a game night, add participants, update a score, join from a spectator browser, and confirm the score update and Realtime connection work.
8. Complete a game night and confirm its winner appears in the historical leaderboard.

Expected result: the game-night flow works over the LAN with the Unraid-hosted services, without a hosted Supabase dependency or a connection to the existing MariaDB/MySQL instance.

## Validate lifecycle and persistence

1. Record a completed game-night result.
2. Stop and restart the whole Compose project using Compose-Craft.
3. Wait for health checks and open the application from the second device.
4. Confirm the completed result remains in the leaderboard.
5. Repeat for 10 consecutive stop/start cycles.

Expected result: the stack returns to healthy service after each cycle, and all saved results remain available.

## Validate backup and restore

1. Run `sh deploy/unraid/scripts/backup.sh` and verify the timestamped archive exists with owner-only permissions.
2. Inspect the archive listing and confirm it contains `manifest.json`, `postgres.dump`, `storage/`, `db-config/`, and `configuration/`.
3. Stop the complete test project in Compose-Craft. Restore using `sh deploy/unraid/scripts/restore.sh /path/to/game-night-backup.tar.gz`; verify the script rejects a running stack before changing data.
4. Start the restored deployment and verify service health, game-night history, and an active test session.
5. Confirm the operator can complete the procedure in under 15 minutes.

Expected result: the restored stack returns to service with the saved records and required files. A copy of persistent storage without a restore test does not count as a verified backup.

## Failure and boundary checks

- Reserve a required host port temporarily; verify startup reports the conflict and identifies the affected service.
- Remove a required setting in the test configuration; verify startup fails with actionable guidance and does not print secret values.
- Stop a required backend service; verify health status becomes unhealthy and the frontend does not misrepresent backend-dependent functionality as available.
- Inspect host-published ports; verify PostgreSQL, Studio, and internal Supabase services are not exposed.
- Review the existing MariaDB/MySQL container and data locations before and after the test; verify they remain unchanged.

## Recovery and upgrade

Before updating the test stack, make and validate a backup. Apply a compatible pinned upstream release through Compose-Craft, verify health and saved records, and follow the documented rollback procedure if the update fails.
