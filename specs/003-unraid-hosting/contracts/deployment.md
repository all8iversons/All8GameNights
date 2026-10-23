# Unraid Deployment Contract

## Operator-managed stack

- The application is delivered as one Docker Compose project importable into Compose-Craft on Unraid.
- Compose-Craft controls start, stop, restart, update, logs, and service status for the project.
- The stack uses the official self-hosted Supabase service topology at a pinned compatible release.
- Startup must fail visibly when required configuration is invalid or a required service fails its health check.
- The stack must not modify, mount, or depend on the operator's existing MariaDB/MySQL container or data.

## Browser-facing services

| Service | Contract |
|---|---|
| Web application | Reachable from the configured LAN address and host port; receives only the public Supabase URL and publishable key at runtime. |
| Supabase API gateway | Reachable from the web application clients at the configured LAN address and host port; routes supported API, function, and Realtime/WebSocket traffic. |
| Realtime | Browser connections use the API gateway route and support WebSocket upgrades; internal Realtime service ports are not published. |

The external host ports must be configurable to avoid conflicts with Unraid and other containers. Compose defaults must not make PostgreSQL, Studio, or internal service ports available to the LAN. If HTTPS or a reverse proxy is configured, the public API URL, allowed origin, forwarded headers, and WebSocket upgrade behavior must agree.

## Configuration contract

- A documented example file lists all operator-supplied values without containing real secrets.
- Generated Supabase secrets and database passwords must replace upstream defaults before first use.
- Server-only values, including the service-role key and database credentials, stay in the Compose environment or protected secret storage and are never passed to the web client.
- The frontend's runtime configuration contains only the API gateway URL and publishable key.
- The function allowed-origin setting matches the configured frontend origin.
- Secret and configuration files are excluded from Git and must be access-controlled in appdata and backups.

Exact environment variable names are taken from the pinned upstream Supabase Compose release and documented alongside the application-specific values.

## Persistent storage contract

- All stateful Supabase paths map to named, dedicated Unraid appdata locations.
- PostgreSQL storage is separate from any Supabase file-storage path and from the existing MariaDB/MySQL appdata.
- Container replacement or stack restart must not remove persistent paths.
- Backup and restore instructions cover PostgreSQL, enabled file storage, and the configuration/secrets needed to reconstruct the deployment.

## Health and maintenance contract

- Required services define health checks and dependency startup ordering.
- Compose-Craft status and logs must distinguish unhealthy dependencies from a healthy application.
- Updates use a pinned release and include backup, compatibility review, and rollback guidance.
- A restore validates the expected application records before the restored stack is treated as operational.
- Internal service exposure is not increased as a side effect of an application update.
