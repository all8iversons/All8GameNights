# Data Model: Unraid Hosting

This feature adds a deployment boundary for the existing application. It does not change the game-night schema defined in the Supabase migrations. The operator's MariaDB/MySQL database is not part of this model.

## Deployment

Represents one installed application stack managed through Compose-Craft or a compatible Compose manager.

| Field | Description | Validation / invariant |
|---|---|---|
| Stack identity | Name used to identify the application Compose project | Stable across restarts and updates |
| Application image version | Version of the web application image | Must identify a reproducible, supported build |
| Supabase stack version | Pinned upstream self-hosted Supabase release | Must be compatible with the application and its migrations |
| Public application address | LAN address or hostname used by browsers | Must resolve from client devices on the intended network |
| Published host ports | Host ports mapped to frontend and API gateway | Must be available and configurable; internal database and Studio ports remain unpublished |
| Service health | Health state for application and required backend services | Unhealthy or unavailable dependencies must not be reported as healthy |

## Operator Configuration

Represents settings required to run and access the stack.

| Field | Description | Validation / invariant |
|---|---|---|
| Supabase public URL | Browser-facing base URL for the API gateway | Must be reachable by client devices; does not contain a privileged key |
| Publishable key | Public browser client key | Must not provide server-side administrative privileges |
| Service secrets | Supabase signing, database, and service-role secrets | Generated, non-default, server-only, and excluded from version control and browser assets |
| Allowed application origin | Origin permitted for function requests | Must match the configured application origin |
| Persistent data root | Operator-selected appdata location for Supabase data | Must be writable and separate from the existing MariaDB/MySQL data paths |

The exact upstream variable names and required secret set are version-specific and must be copied from the pinned official Supabase deployment, validated before startup, and documented without placing real values in the repository.

## Persistent Service Data

| Data group | Contents | Persistence and recovery |
|---|---|---|
| Supabase PostgreSQL | Game nights, participants, teams, challenges, and application records | Dedicated persistent path; database-aware backup and restore |
| Supabase file storage, if enabled | Stored files managed by the Supabase stack | Separate persistent path; file-level backup and restore |
| Supabase configuration | Compose settings, generated secrets, and deployment configuration | Restricted persistent path; included in encrypted or otherwise access-controlled backup |
| Application image | Static web application and runtime configuration mechanism | Re-created from a pinned build; not a data backup |

PostgreSQL, file storage, and configuration backups must be treated as distinct recoverable components. The existing MariaDB/MySQL service and its data are explicitly excluded.

## Existing Game-Night Data

The application retains its current Supabase data model, constraints, and migrations. PostgreSQL remains authoritative for game-night state, while existing API functions enforce writes and Realtime communicates state changes. The app's current SQL migrations are the schema source of truth.

An initial empty Unraid installation is assumed. Migration of records from a separate managed Supabase project is not specified by this feature and requires a separately agreed migration/cutover procedure if existing hosted records must be retained.

## Lifecycle States

```text
Unconfigured -> Starting -> Healthy
                   |          |
                   v          v
                 Failed <- Stopping -> Stopped
                   |
                   +---- operator corrects configuration / restarts ----> Starting
```

- **Unconfigured**: Required addresses, secrets, or persistent paths are not ready.
- **Starting**: Compose is creating services and waiting for required health checks.
- **Healthy**: Frontend and required backend dependencies have passed their health checks.
- **Failed**: A required service failed startup or became unhealthy; operator-visible logs and service status identify the failure.
- **Stopping / Stopped**: The operator has requested shutdown; persistent data remains in its configured paths.

## Validation Rules

- Required settings must be present and valid before the stack reports healthy.
- Secret values are never emitted to browser runtime configuration or diagnostic output.
- The PostgreSQL data path must not overlap with the existing MariaDB/MySQL data path.
- A backup restore must not overwrite a live database without an explicit stop/restore procedure.
- Updates must use a compatible pinned release and preserve the persistent paths.
