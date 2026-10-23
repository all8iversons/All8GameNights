# Unraid deployment

This deployment runs the web application and the Supabase services it depends on as one Compose project. It uses the official [Supabase self-hosted Docker deployment](https://github.com/supabase/supabase/tree/8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110/docker), pinned at commit `8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110`. The upstream stack supplies PostgreSQL, Auth, PostgREST, Realtime, Storage, Edge Runtime, and the Envoy API gateway; the local overlay adds the game-night frontend, function mounts, migrations, and appdata paths. It uses an isolated PostgreSQL database and does not connect to, modify, or reuse the existing MariaDB/MySQL service.

## Requirements

- Unraid with Docker enabled and Compose-Craft installed.
- Docker Compose 2.20 or later for the `include` syntax used by this project.
- A checked-out copy of this repository on the Unraid server. Keep the repository structure intact so the Compose build context and Edge Function mounts resolve.
- Git, `sh`, `openssl`, and `chmod` for the one-time preparation script.
- `jq`, `tar`, and `awk` on the Unraid host for protected backup and restore operations.
- At least 4 GB RAM, 2 CPU cores, and 40 GB SSD for Supabase; 8 GB RAM, 4 CPU cores, and 80 GB SSD or more are recommended. These resources are shared with Unraid and its other workloads.
- Available LAN ports for the web app and Supabase API gateway.

Supabase self-hosting is community-supported. The operator is responsible for securing, updating, monitoring, backing up, and recovering this stack.

## Prepare the deployment

1. Put a full repository checkout on Unraid. Do not copy just `compose.yaml`: the app image build and game-night Edge Functions use files elsewhere in the checkout.
2. Open a terminal at the repository root and prepare the pinned official Supabase Docker deployment:

   ```sh
   sh deploy/unraid/prepare-supabase.sh
   ```

   The script fetches only the upstream `docker/` directory at commit `8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110`, creates the ignored local `.env` from the upstream example, generates unique Supabase secrets using the upstream key generator, and sets restrictive permissions on the secret file. Re-running the script does not replace an existing `.env`.

3. Edit `deploy/unraid/.env`:
   - Set `SUPABASE_PUBLIC_URL` to `http://<UNRAID-LAN-IP>:<API_GW_HTTP_PORT>` or to the trusted LAN hostname and gateway port.
   - Set `ALLOWED_ORIGIN` to `http://<UNRAID-LAN-IP>:<APP_HTTP_PORT>` or the exact frontend origin.
   - Choose unused `APP_HTTP_PORT` and `API_GW_HTTP_PORT` values.
   - Set `APPDATA_ROOT` to a dedicated Unraid appdata directory for this stack. Do not point it at the WoW/MariaDB container's data.
   - Confirm `GAME_NIGHT_FUNCTIONS_PATH` is the absolute path to this checkout's `supabase/functions` directory.
   - Keep `ANON_KEY` and generated settings intact. The anonymous key is public browser configuration; service-role, JWT, and database credentials are secrets and must never be copied into browser settings.
   - Keep `FUNCTIONS_VERIFY_JWT=false`, matching this repository's Supabase function configuration; the functions enforce the game's host/spectator capabilities themselves.

   The Supabase pooler is disabled by default so it does not publish database ports. Enable its `manual-database-access` profile only when needed for a secured local administration workflow; do not expose PostgreSQL to the internet.

## Install and start through Compose-Craft

1. In Compose-Craft, create/import the project from `deploy/unraid/compose.yaml` in the repository checkout. Preserve the repository directory as the Compose project directory so `.env`, app build context, and included upstream paths resolve.
2. Validate the project configuration. Resolve any unavailable host ports or missing-setting errors before starting.
3. Start the project and wait for the Supabase API gateway and web service to report healthy.
4. Open `http://<UNRAID-LAN-IP>:<APP_HTTP_PORT>` from another device on the LAN.
5. Start a game night, add at least two players, update a score, and open the spectator view on another device. Confirm live updates work. Complete a game night and confirm the leaderboard records the result.
6. The host session is restored after a reload in the same browser tab. To reconnect from another device, use the room code and the private host recovery key revealed on the host board; do not share that key with spectators.
7. While a game is active, use **Open display-only board** on the host board to open a widescreen-only tab, or share that display link with the monitor's browser. The display URL loads live standings, challenges, and timers without restoring host privileges or showing game controls. Viewers can also enter the room code and choose **Join display-only**.

This baseline is LAN-only and does not require public internet access. If you later add a reverse proxy, configure HTTPS, the exact application origin, and WebSocket forwarding for Supabase Realtime. Do not expose Studio or internal service ports.

## Persistent data and existing MariaDB

The Compose overlay stores PostgreSQL, Supabase file storage, and PostgreSQL custom configuration under separate subdirectories of `APPDATA_ROOT`. Docker restarts and container replacement preserve these paths. On first startup, a migration job applies the existing SQL migrations and challenge seed in order, recording applied files in PostgreSQL so later restarts do not reset or reapply the schema. The upstream Supabase project files and the application's Edge Functions are not database data.

The stack does not attach to the existing MariaDB/MySQL service, use its credentials, or alter its schema or files. HeidiSQL remains a client for the existing MariaDB server; it is not used by this PostgreSQL-backed Supabase stack.

## Operations and troubleshooting

- Use Compose-Craft to start, stop, restart, and inspect logs for the complete project.
- If the project will not start, inspect the health and logs of the API gateway and its dependencies. Correct missing or invalid settings without copying secrets into support logs.
- If another Unraid service already owns a required host port, choose an unused `APP_HTTP_PORT` or `API_GW_HTTP_PORT`, update the matching URL/origin in `.env`, and restart the stack.
- If the frontend loads but game-night requests fail, verify `SUPABASE_PUBLIC_URL`, `ANON_KEY`, and `ALLOWED_ORIGIN` agree with the LAN address and ports.
- If the host reconnects from another device, verify they have both the room code and private host recovery key. The room code alone only joins the spectator board.
- If Realtime is not connected through a later-added proxy, verify that the proxy forwards WebSocket upgrade requests.
- Preserve the pinned upstream revision during updates. Review upstream changes and take a verified backup before changing the Supabase version.

## Backup, restore, and updates

The PostgreSQL volume, Supabase file-storage volume, and `.env` configuration contain separate recovery-critical data. Persistent appdata alone is not a verified backup. Before relying on this deployment, establish a database-aware PostgreSQL dump, a separate copy of file storage and protected configuration, and a restore rehearsal on a stopped or fresh compatible stack. Store backups so only trusted administrators can access the secrets they contain.

Run a backup from the repository checkout on Unraid:

```sh
sh deploy/unraid/scripts/backup.sh
```

The script writes a timestamped archive under `deploy/unraid/backups/` (or a directory passed as its first argument). It contains a PostgreSQL custom-format dump of the game-night `public` and Supabase Storage metadata schemas, Supabase Storage files, PostgreSQL custom configuration, the deployment `.env`, Compose files, and a manifest with the pinned upstream revision. The archive is created with owner-only permissions. Copy it to separate, access-controlled storage; it contains server secrets. The backup requires the database and persistent appdata directories to be present.

To restore, prepare the same pinned Supabase checkout and `.env`, stop the entire Compose project in Compose-Craft, and run:

```sh
sh deploy/unraid/scripts/restore.sh /path/to/game-night-backup.tar.gz
```

The script validates the archive and manifest, requires the same pinned Supabase revision, refuses to proceed while any project service is running, and asks for confirmation. It first takes a protected logical snapshot of the current `public` and `storage` schemas, retains it under `APPDATA_ROOT` as `game-night-pre-restore-<timestamp>.dump`, then retains existing Storage and database-configuration directories with a `.pre-restore` suffix. It starts only PostgreSQL, restores the game-night and Storage metadata schemas and file data, and stops PostgreSQL. If database restoration fails, it attempts to reapply the retained snapshot. For intentional non-interactive automation, set `RESTORE_CONFIRM=YES`. Review the archived `configuration/.env` if recovering rotated secrets or origins; do not overwrite the active file without checking its paths and LAN settings. Start the full project in Compose-Craft and verify health, game-night history, and an active test session before treating recovery as complete. Keep the retained pre-restore files until verification succeeds.

Before an upstream or application update, verify a recent backup and retain the prior image and upstream revision for rollback. For rollback, stop the project, check out the previously used repository/upstream revision, restore a backup created from that same pinned Supabase revision, start the project, and verify service health and saved records. The restore script rejects a backup whose upstream revision differs from the prepared checkout. Do not delete `APPDATA_ROOT` when removing or recreating containers.

The backup archive does not contain the PostgreSQL data directory itself; its logical dump is restored into the installed, compatible Supabase PostgreSQL service. It does not include or access the existing MariaDB/MySQL service or its appdata paths.
