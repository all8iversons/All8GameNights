# Feature Specification: Unraid Hosting

**Feature Branch**: `003-unraid-hosting` (not created)

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "The application should be able to be hosted and managed on an unraid server"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and access the application (Priority: P1)

As an Unraid server operator, I want to install and configure the application on my server, so people on my network can use the game-night experience without running it on a personal computer.

**Why this priority**: Hosting the application on the intended server is the central value of this feature.

**Independent Test**: On a supported Unraid server, follow the documented installation and configuration flow, then open the application from another device on the local network.

**Acceptance Scenarios**:

1. **Given** an Unraid server meeting the documented prerequisites, **When** the operator installs and configures the application, **Then** the application starts and is reachable at the configured network address.
2. **Given** the operator has not supplied a required setting or has supplied an invalid one, **When** the operator attempts to start the application, **Then** the missing or invalid setting is identified with actionable guidance.
3. **Given** the application is available on the server, **When** a host starts or joins a game night from another device, **Then** the existing game-night experience is usable without requiring a development workstation.
4. **Given** the Unraid installation has no connection to a hosted application backend, **When** the operator starts the application and its required services, **Then** users can complete the existing game-night experience using the Unraid-hosted services.

---

### User Story 2 - Manage the application lifecycle (Priority: P2)

As an Unraid server operator, I want to stop, start, restart, and update the application through the server's normal management experience, so I can maintain it without losing game-night data or relying on command-line administration.

**Why this priority**: Reliable routine administration is necessary for the application to be practical as a server-hosted service.

**Independent Test**: Install the application, stop and restart it through Unraid, and verify that it returns to service with existing game-night records intact.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** the operator stops and restarts it through Unraid, **Then** the application returns to a usable state.
2. **Given** the application has stored game-night records, **When** it is restarted or updated, **Then** those records remain available.
3. **Given** the application fails to start or becomes unavailable, **When** the operator checks its status, **Then** the failure is distinguishable from a healthy running state and provides a useful next step.

---

### User Story 3 - Protect and recover application data (Priority: P2)

As an Unraid server operator, I want application data and configuration to be identifiable and recoverable, so a server restart, update, or data-volume failure does not unexpectedly erase game-night history.

**Why this priority**: Game-night history is persistent user data, and operators need confidence that routine maintenance will not destroy it.

**Independent Test**: Create game-night data, make a backup using the documented process, simulate loss of the application data location, restore it, and verify the records are available.

**Acceptance Scenarios**:

1. **Given** the application has saved game-night records, **When** the operator follows the documented backup procedure, **Then** the backup includes the data required to recover those records.
2. **Given** a valid backup and a fresh application installation, **When** the operator follows the documented restore procedure, **Then** the saved game-night records are available again.
3. **Given** the application is upgraded, **When** the upgrade completes, **Then** the operator can identify how to recover the prior data if the updated application cannot be used.

### Edge Cases

- The server has insufficient resources or an unsupported system configuration; installation or startup identifies the unmet prerequisite.
- A required setting is missing, malformed, or contains an inaccessible service address; startup reports the affected setting without exposing secret values.
- A configured network port or address is already in use; the operator receives guidance to resolve the conflict.
- The server restarts while a game night is active; saved records remain available, and users receive an understandable outcome for any in-progress activity that cannot resume.
- The application is updated while data is stored in an older format; the update preserves records or clearly explains that it cannot proceed safely.
- The configured data location is unavailable or has insufficient space; the application does not silently report that records were saved when they were not.
- An operator restores a backup containing data newer or older than the installed application supports; the restore process reports the compatibility issue before damaging existing data.
- The server is reachable from the local network but not from outside it; local access remains supported without requiring public internet exposure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be installable and configurable on an Unraid server as a Docker Compose stack that the operator can manage through Compose-Craft or a compatible Unraid Compose manager.
- **FR-002**: The deployment MUST run the Supabase services required by the application on Unraid, including its PostgreSQL database, live updates, and backend functions, and MUST NOT require a hosted Supabase project.
- **FR-003**: The operator MUST be able to configure the network address and connection settings needed to make the application available to users.
- **FR-004**: The operator MUST be able to start, stop, restart, and update the application through the standard Unraid management experience.
- **FR-005**: The application MUST preserve saved game-night records through ordinary application restarts and server reboots.
- **FR-006**: The deployment MUST identify where persistent application data and required configuration are stored and how they are included in a backup.
- **FR-007**: The operator MUST be able to restore saved game-night records by following documented recovery instructions.
- **FR-008**: The operator MUST be able to distinguish a healthy application from one that failed to start or is unavailable.
- **FR-009**: The application MUST report missing, invalid, or unavailable required configuration in actionable terms without exposing secret values.
- **FR-010**: Installation and maintenance instructions MUST identify prerequisites, initial configuration, network access, update steps, backup, restore, and troubleshooting.
- **FR-011**: The deployment MUST NOT require public internet exposure for access from the operator's local network.
- **FR-012**: The running application MUST provide the existing game-night functionality to users accessing it from other devices on the configured network.
- **FR-013**: The deployment MUST treat the operator's existing MariaDB/MySQL server as separate from the application's required PostgreSQL database and MUST NOT modify that existing database as part of installation or updates.

### Key Entities

- **Unraid installation**: The installed application instance, including its server configuration, network settings, and lifecycle status.
- **Application data**: Persistent game-night records and any other information required to restore the experience.
- **Backup**: A recoverable copy of application data and the configuration information needed to restore service.
- **Operator configuration**: The non-secret and secret settings that determine how the application and its required services connect and are accessed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator with a supported Unraid server and the required service settings can complete installation and open the application on a second device within 15 minutes.
- **SC-002**: In 10 consecutive stop-and-restart trials through Unraid, the application returns to a usable state and all previously saved game-night records remain available.
- **SC-003**: An operator who follows the backup and restore instructions can recover saved game-night records in under 15 minutes.
- **SC-004**: At least 90% of first-time operators can complete installation and initial configuration without consulting support.
- **SC-005**: In a review of the setup and recovery instructions, operators can identify the required settings, persistent data location, backup procedure, and restore procedure without ambiguity.
- **SC-006**: Users can complete the existing game-night experience when the Unraid-hosted services are available and no hosted application backend can be reached.

## Assumptions

- The target operator has administrator access to an Unraid server and can configure its network and storage.
- The operator already has Compose-Craft available on Unraid, as shown in the supplied screenshot; the deployment instructions will use it to manage the stack.
- The application remains intended for use on the operator's local network; public internet access is not required for this feature.
- Existing game-night behavior and saved records should remain compatible with the Unraid-hosted experience.
- The application currently depends on Supabase services, including PostgreSQL, live updates, and backend functions; the Unraid deployment will host the required services locally rather than relying on the hosted project.
- The operator has an existing MariaDB/MySQL server on Unraid accessed through HeidiSQL. That database is separate from the application's PostgreSQL-backed Supabase services and will remain unchanged.
- Any credentials or other secrets required to connect application services must be supplied by the operator and protected from public exposure.
- The feature covers installation, routine operation, persistence, and recovery on Unraid; redesigning game-night functionality is out of scope.
