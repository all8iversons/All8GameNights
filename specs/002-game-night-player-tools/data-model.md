# Data Model: Game Night Player Tools

## GameNight

Existing event record. Status remains `setup`, `active`, or `completed`.

New events have a unique six-digit numeric join code. Only its SHA-256 hash is stored in `share_code_hash`. Existing events retain their previously issued long code for compatibility. Since join codes are short and also authorize casual score submissions, invalid lookups and public score mutations are rate-limited; the separate host capability remains high-entropy.

**Relationships**: Has many participants, teams, and challenge rounds. Additions and team/round changes are accepted in `setup` and `active`; completed nights are immutable.

Snapshot challenge counts distinguish the number of enabled catalog entries from enabled entries not yet drawn in this game night, so disabling an already-used challenge does not falsely exhaust the remaining pool.

## Participant

Existing player record, extended with an optional team assignment.

| Field           | Type           | Rules                                                                     |
| --------------- | -------------- | ------------------------------------------------------------------------- |
| `id`            | UUID           | Primary identifier                                                        |
| `game_night_id` | UUID           | Required event reference                                                  |
| `team_id`       | UUID, nullable | Optional team belonging to the same event                                 |
| `display_name`  | string         | Trimmed, 1-40 characters, unique among active participants within an event without case sensitivity |
| `score`         | integer        | Authoritative individual score; starts at zero                            |
| `created_at`    | timestamp      | Set on addition                                                           |
| `removed_at`    | timestamp, nullable | Null while active; set on host removal, retaining historical records  |

**State/validation**:

- Additions are allowed before or during active play, but not after completion.
- Team assignment must refer to a team in the same game night.
- An unassigned player remains in individual standings and contributes to no team total.
- A removed player is excluded from the active roster, standings, and future mutations. Removal stops and finishes unfinished rounds, clears team assignment, and preserves score and round history.
- A removed player's display name may be reused by a newly added active participant; the new participant receives a distinct ID.
- A host may rename an active participant during setup or active play. The trimmed name must be 1-40 characters and unique among active participants in that game night. The participant row is scoped to one game night; no global player identity or cross-game rename is implied.

## Team

Named group within one game night.

| Field           | Type      | Rules                                                                                |
| --------------- | --------- | ------------------------------------------------------------------------------------ |
| `id`            | UUID      | Primary identifier                                                                   |
| `game_night_id` | UUID      | Required event reference                                                             |
| `name`          | string    | Trimmed, non-empty, length-bounded, unique within the event without case sensitivity |
| `created_at`    | timestamp | Set on creation                                                                      |

**Relationships**: Has zero or more assigned participants. Its displayed score is derived as the sum of member participant scores. Removing a team clears its members' assignments but does not remove players or scores.

Hosts can randomize all current participants across existing teams, assigning team sizes that differ by at most one. They can also generate a replacement team set by choosing a team count or players-per-team capacity. Generated teams use unique original space-themed names, are assigned randomly and evenly in one transaction, and preserve individual player scores. A capacity-based setup may produce a smaller final team.

Hosts can randomize all current participants across existing teams. The server randomizes player and team order in one transaction and assigns team sizes that differ by no more than one; players are not left unassigned by this operation.

## ChallengeRound

Existing round record, extended with an assigned player and explicit completion state.

| Field                      | Type                           | Rules                                                 |
| -------------------------- | ------------------------------ | ----------------------------------------------------- |
| `id`                       | UUID                           | Primary identifier                                    |
| `game_night_id`            | UUID                           | Required event reference                              |
| `participant_id`           | UUID                           | Required player reference in the same game night      |
| `challenge_id`             | UUID                           | Required catalog reference                            |
| `selected_at`              | timestamp                      | Set on draw                                           |
| `finished_at`              | timestamp, nullable            | Set when host finishes the round; cleared by an eligible undo |
| `timer_status`             | enum                           | `ready`, `running`, `paused`, `expired`, or `stopped` |
| `duration_seconds`         | positive integer, nullable     | Timer duration                                        |
| `deadline_at`              | timestamp, nullable            | Authoritative running deadline                        |
| `paused_remaining_seconds` | non-negative integer, nullable | Remaining time while paused                           |

**State/validation**:

- A challenge can be drawn once per game night.
- A player can have at most one round with no `finished_at` in a game night.
- Round finish is separate from timer reset. Finish stops any active timer and releases the player for a later challenge.
- A host may undo only the player's most recently selected finished round, and only when that player has no unfinished round. The same history row is reopened with `finished_at` cleared and timer state reset to `ready`; older finishes, removed players, and completed game nights are not eligible.
- A host may issue a replacement challenge after confirming. The draw operation atomically finishes the player's current round, stops and clears its timer, retains it as history, and assigns a different unused challenge. If no unused challenge remains, the operation changes nothing.
- Timer operations apply only to the specified round; the database deadline remains authoritative.
- Challenge assignment and finish are rejected after game completion.
- Teammates may swap their unfinished challenge assignments in an active game. The round records and timer state stay attached to the challenge; trades are rejected while either timer is running and idempotent retries cannot swap twice.

## Score submission

No player account is added. The spectator code authorizes casual score-submission requests; the selected participant ID/name identifies whose score changes, not the submitter.

**Validation**: Require a valid spectator code, active game night, existing participant in that night, non-zero integer delta, valid idempotency key, and request rate limits. Anyone with the spectator code can submit for any participant; the user-facing experience must disclose this.

Challenge trades use the same shared room-code access model and disclose that the room code does not verify the requester’s identity. Public score and trade mutations share the per-IP, per-game-night rate limit. The database requires both participants to be on the same non-null team and to have unfinished rounds.

## Shared challenge catalog

Challenges are shared across all game nights. Hosts can list, add, edit, enable, or disable catalog entries through host-authorized operations. Editing a catalog entry changes the displayed name and instructions on existing assignments because challenge rounds retain a reference to the catalog row. Disabling a challenge prevents future draws but does not delete it, change its historical consumption, or remove existing assignments.

| Field          | Type    | Rules                                      |
| -------------- | ------- | ------------------------------------------ |
| `id`           | UUID    | Primary identifier                         |
| `name`         | string  | Trimmed, 1-100 characters, globally unique |
| `instructions` | string  | Trimmed, 1-1,000 characters                |
| `enabled`      | boolean | Controls eligibility for future draws      |

## Team totals

Team totals are derived from current participant scores, not persisted separately. Reassignment moves the player's current score from the old team's total to the new team's total.

## Compatibility

- Preserve existing game-night status and individual score history.
- Existing rounds from earlier migrations are associated with a player by a deterministic data migration where possible; if an active legacy round cannot be assigned, it remains visible to the host and must be resolved before another draw is made.
- Completed game-night history remains based on individual participant scores.
