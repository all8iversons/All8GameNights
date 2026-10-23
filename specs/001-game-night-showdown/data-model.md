# Data Model: Game Night Showdown

## GameNight

Represents a single hosted event.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `created_at` | timestamp | Set when the host creates the event |
| `share_code_hash` | string | Unique hash of the read-only spectator capability; never return the hash to clients |
| `host_token_hash` | string | Hash of the host capability; never return the hash to clients |
| `status` | enum | `setup`, `active`, or `completed`; a completed night cannot be reopened for scoring |
| `started_at` | timestamp, nullable | Set when the host starts play |
| `completed_at` | timestamp, nullable | Set once when the host completes the night |

**Relationships**: Has many participants and challenge rounds. Winner records are derived from final participant scores.

**Validation and transitions**:

- A night starts in `setup`; participants can be added while it is in setup.
- A night must have at least one participant before transition from `setup` to `active`.
- Only an active night accepts score, draw, and timer changes; participants cannot be added after play starts.
- Only a setup or active night with at least one participant can be completed.
- Completing a night freezes its participant scores and ends its host write capability.
- Each new night starts with no selected challenges.

## Participant

Represents one named player and their score within a specific night.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `game_night_id` | UUID | Required foreign key to `GameNight` |
| `display_name` | string | Required, trimmed, non-empty; length bounded by the UI and server validation |
| `score` | integer | Initialized to zero; score changes must be valid integer deltas |
| `created_at` | timestamp | Set when participant is added |

**Relationships**: Belongs to one game night. A participant name/score pair is not a global account.

**Validation**: Duplicate names within a night should be rejected without regard to surrounding whitespace and case, so the host can distinguish players reliably. Scores may be positive, zero, or negative; the specification does not impose a score floor.

## Challenge

An entry in the precreated video game challenge catalog.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `name` | string | Required, non-empty |
| `instructions` | string | Required, non-empty |
| `enabled` | boolean | Only enabled challenges are eligible for a draw |

The catalog is seeded/maintained as application data for the initial release; user editing and importing are out of scope.

## ChallengeRound

Represents a challenge drawn during a specific game night, along with its timer state.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `game_night_id` | UUID | Required foreign key to `GameNight` |
| `challenge_id` | UUID | Required foreign key to `Challenge` |
| `selected_at` | timestamp | Set when the challenge is drawn |
| `timer_status` | enum | `ready`, `running`, `paused`, `expired`, or `stopped` |
| `duration_seconds` | positive integer, nullable | Set when the host starts the timer |
| `deadline_at` | timestamp, nullable | Authoritative expiration time while running |
| `paused_remaining_seconds` | non-negative integer, nullable | Captured when a running timer is paused |

**Relationships**: Belongs to one game night and one challenge.

**Validation and transitions**:

- A database uniqueness constraint on `(game_night_id, challenge_id)` prevents repeat selection during one night.
- Draw selection and insertion occur in one transaction; if the catalog is exhausted, return an explicit no-unused-challenges result without creating a draw.
- Timer start requires a positive duration. Starting a ready/reset timer sets a server-authoritative deadline.
- Pause stores remaining time and clears the running deadline; resume creates a new deadline from the saved remainder.
- Reset returns the current timer to `ready` and clears its deadline/remainder.
- Selecting another challenge stops any currently running challenge timer before presenting the new round. A new timer requires an explicit host start action.
- Expiration is determined by the authoritative deadline, not a viewer's local interval.

## Winner record (derived)

Winner records are calculated when a game night is completed by finding the maximum participant score and including every participant at that score. Do not store a separate mutable winner row: completed participant scores are the source of truth, preventing a winner snapshot from disagreeing with final scores. The historical leaderboard returns one event result with all tied winners and the final participant scores.

## Authorization and data minimization

- Store hashes of host and spectator capabilities, not their plaintext values.
- Host capabilities authorize mutations only for their corresponding active game night.
- Spectator capabilities are read-only and must never authorize score, timer, challenge, or completion changes.
- Do not put the host capability in the spectator URL, application logs, analytics, or error reports.
- Retain only participant display names and game data needed for game-night history.
