# Research: Unraid Hosting

## Decision 1: Use Supabase's official self-hosted Docker Compose deployment

- **Decision**: Package the existing web application with the official Supabase self-hosted Docker Compose stack, including the PostgreSQL database, API gateway, Auth, PostgREST, Realtime, and Edge Runtime services required by this application. Manage the stack as one Compose project in Compose-Craft, which is present in the operator's supplied Unraid screenshot.
- **Rationale**: The application currently uses the Supabase JavaScript client for Realtime and Supabase Edge Functions for game-night APIs. The official self-hosted stack supplies the coordinated services and PostgreSQL behavior the application already expects. Unraid's native Docker UI does not natively manage Compose projects; a Compose manager is needed to preserve service dependencies and the upstream stack as a unit.
- **Alternatives considered**:
  - Separate Unraid templates for each service: rejected because it requires translating a coordinated upstream stack and risks losing its service dependencies and upgrade behavior.
  - Use the existing MariaDB/MySQL service: rejected because it is not compatible with the app's PostgreSQL-backed Supabase services, Realtime, or Edge Functions without a broader backend rewrite.
  - Continue using managed Supabase: simpler operationally, but conflicts with the clarified requirement that the application must run without a hosted application backend.
  - A separate Linux server: viable if Compose-Craft management, resource contention, or isolation on Unraid is unacceptable, but it does not meet the current target-platform request.

## Decision 2: Isolate the application's database and files

- **Decision**: Give the Supabase PostgreSQL service and any enabled Supabase persistent services dedicated Unraid appdata paths. Do not reuse or mount the operator's existing MariaDB/MySQL files or container.
- **Rationale**: Supabase self-hosting uses PostgreSQL, while the existing HeidiSQL-accessed service is MariaDB/MySQL. Separate paths and Compose networks prevent accidental cross-configuration and allow the existing database to continue independently.
- **Alternatives considered**:
  - Point Supabase at the existing MariaDB/MySQL service: rejected because the database engines and service contracts do not match.
  - Place both database services in shared data paths: rejected because it creates avoidable data-loss and maintenance risks.

## Decision 3: Keep internals private and expose user traffic through the gateway

- **Decision**: Publish the web frontend and Supabase API gateway only. Route browser API, function, and Realtime/WebSocket traffic through the gateway. Keep the PostgreSQL, Studio, and other internal service ports private to the Compose network unless a deliberate, separately secured maintenance path is added.
- **Rationale**: The app needs browser access to the Supabase API and Realtime but not direct database access. Supabase's Docker guide identifies gateway port 8000 and documents separate database/pooler ports. Limiting host-published ports reduces collisions with Unraid and other applications and avoids exposing administrative services.
- **Alternatives considered**:
  - Publish all upstream service ports to the LAN: rejected because most are internal and needlessly increase attack surface and port conflicts.
  - Publish PostgreSQL for direct client access: not required by the current application or LAN user flows; keep the database private by default, and treat any separately requested administrator access as a secured operational configuration rather than a public application endpoint.

## Decision 4: Use runtime frontend configuration and generated server secrets

- **Decision**: Serve the built frontend with its public Supabase URL and publishable key injected at container startup. Keep all privileged Supabase secrets in the server-side deployment configuration; generate non-default values and exclude secret files from Git.
- **Rationale**: The current Vite app embeds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. Runtime configuration allows one image to be configured for the operator's LAN hostname/IP and chosen gateway port without rebuilding. The app's edge functions read the server-side service-role key and must never receive it in frontend configuration.
- **Alternatives considered**:
  - Build a separate frontend image for each Unraid host address: rejected because it makes LAN endpoint changes and updates unnecessarily difficult.
  - Expose service-role credentials as Vite variables: rejected because these values are privileged and would become visible to browser clients.
  - Reuse upstream default secrets: rejected because defaults are unsuitable for a user-managed server.

## Decision 5: Plan health, updates, backup, and recovery as operator responsibilities

- **Decision**: Use Compose service health checks and actionable container logs; document pinned-stack update review and rollback. Persist PostgreSQL and any enabled file-storage data, back up PostgreSQL using a database-aware dump, separately back up persistent files and configuration/secrets, and verify restore on a fresh compatible stack.
- **Rationale**: Self-hosted Supabase assigns maintenance, backup, and recovery to the operator. Its update script does not back up PostgreSQL or Storage data. Compose service health and an explicit recovery procedure are necessary to satisfy application lifecycle and data-recovery requirements.
- **Alternatives considered**:
  - Assume that Docker volumes or Unraid array protection are backups: rejected because persistent storage alone does not provide verified point-in-time recovery.
  - Use the upstream update script as a complete backup: rejected because it covers configuration but not PostgreSQL and Storage data.

## Operational constraints and risks

- Supabase's Docker guide lists minimum host resources of 4 GB RAM, 2 CPU cores, and 40 GB SSD, and recommends 8 GB or more RAM, 4 or more cores, and 80 GB or more SSD. These are shared with Unraid and the operator's other services.
- Unraid does not natively support Compose. Compose-Craft is a community management layer and must remain compatible with the upstream Compose project.
- Supabase self-hosting is community-supported and makes the operator responsible for security, updates, monitoring, availability, backups, and recovery; it does not provide all managed-platform features.
- HTTPS and WebSocket forwarding must be configured if the operator later enables access through a reverse proxy. The feature's required baseline is local-network access without public internet exposure.
- Upstream default ports can conflict with Unraid's web UI or other containers. Choose available configurable host ports and avoid publishing the database or Studio.

## References

- [Supabase self-hosting overview](https://supabase.com/docs/guides/self-hosting)
- [Supabase official Docker deployment, configuration, resources, and ports](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase self-hosted Edge Functions](https://supabase.com/docs/guides/self-hosting/self-hosted-functions)
- [Supabase PostgreSQL connection options](https://supabase.com/docs/guides/self-hosting/accessing-postgres)
- [Supabase self-hosted updates](https://supabase.com/docs/guides/self-hosting/updating)
- [Supabase HTTPS and reverse proxy](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https)
- [PostgreSQL database dump and restore](https://www.postgresql.org/docs/current/backup-dump.html)
- [Unraid Docker overview](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/)
- [Unraid Community Applications](https://docs.unraid.net/community-applications/)
- [Unraid container management](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/)
- [Docker Compose startup ordering and health](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker Compose environment variable guidance](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
