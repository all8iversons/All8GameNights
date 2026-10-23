# Game Night Player Tools API Contract

All state-changing calls use JSON and must be handled by the server. Host operations require the existing `Authorization: Bearer <hostCapability>` header. Player score submissions intentionally do not require that host capability: possession of the spectator code is sufficient for casual play and does not verify player identity.

## Create a game night and join

`POST /functions/v1/game-nights` returns a `spectatorCode` that is exactly six numeric digits for new game nights. The code is unique across stored game nights; collision conflicts are retried. Only its hash is stored. Legacy 64-character hexadecimal codes remain accepted for existing game nights.

`GET /functions/v1/game-nights/{spectatorCode}` joins a viewer to the board. Failed lookups are limited to 10 attempts per source IP per 15-minute window. Successful lookups do not consume the failed-attempt allowance.

## Add a participant during setup or play

`POST /functions/v1/game-nights/{spectatorCode}/participants`

Host authorization required. Request:

```json
{ "displayName": "Player name" }
```

Response `201`: `{ "participant": { "id": "uuid", "displayName": "Player name", "score": 0, "teamId": null } }`

Reject completed nights and invalid/duplicate names.

## Submit a score change

`POST /functions/v1/game-nights/{spectatorCode}/participants/{participantId}/score`

No host authorization header is required. The spectator code is the shared capability. Request:

```json
{ "delta": 100, "idempotencyKey": "unique-request-id" }
```

Apply a non-zero integer score delta atomically, validate that the participant belongs to the active game night, and use a unique idempotency key. The operation is limited to 120 requests per IP and game night per 15 minutes. Response `200` returns the updated participant. Reject completed nights, invalid participants, invalid deltas, malformed keys, and rate-limited callers with stable error responses.

## Teams

- `POST /functions/v1/game-nights/{spectatorCode}/teams` with `{ "name": "Team name" }` creates a team; host authorization required.
- `POST /functions/v1/game-nights/{spectatorCode}/teams/{teamId}` with `{ "name": "New name" }` renames it; host authorization required.
- `POST /functions/v1/game-nights/{spectatorCode}/teams/{teamId}/delete` removes the team and clears member assignments; host authorization required.
- `POST /functions/v1/game-nights/{spectatorCode}/teams/randomize` randomizes the full player roster across existing teams; host authorization required. The operation is atomic and resulting team sizes differ by at most one. Response: `{ "updatedCount": 6 }`.
- `POST /functions/v1/game-nights/{spectatorCode}/teams/generate` creates teams and assigns all players atomically; host authorization required. Request is `{ "mode": "team_count" | "players_per_team", "count": 2 }`. Team names are randomly selected from a unique original space-themed list. Existing teams and assignments are replaced; individual scores are preserved. `team_count` creates exactly `count` teams and balances roster sizes within one. `players_per_team` creates `ceil(playerCount / count)` teams, each with at most `count` players. Counts must be positive and no greater than the roster size. Response: `{ "teamCount": 2, "updatedCount": 6 }`.
- `POST /functions/v1/game-nights/{spectatorCode}/participants/{participantId}/team` with `{ "teamId": "uuid" }` assigns the player, or `{ "teamId": null }` removes the assignment; host authorization required.

These operations are allowed during setup and active play, and rejected after completion. Team names are unique within a game night. Team totals are derived in the returned game-night snapshot.

## Draw a challenge for a player

`POST /functions/v1/game-nights/{spectatorCode}/challenge-draws`

Host authorization required. Request:

```json
{ "participantId": "uuid", "idempotencyKey": "unique-request-id" }
```

Response `201` contains the unique challenge round with assigned player ID, challenge details, timer status, and round completion state. Return `409` if the player already has an unfinished round or all enabled challenges have been drawn. Serialize selection and insertion transactionally so the same challenge cannot be assigned twice.

## Control a player challenge timer or finish its round

`POST /functions/v1/game-nights/{spectatorCode}/challenge-rounds/{roundId}/timer`

Host authorization required. Supported actions: `start`, `pause`, `resume`, `reset`, and `finish`. `start` requires a positive whole-second `durationSeconds`; other actions do not. Each operation changes only the referenced player's round. `finish` stops an active timer and marks the round finished, allowing a later draw for that player. `reset` does not finish a round. Reject invalid transitions with `409`.

## Trade unfinished challenges with a teammate

`POST /functions/v1/game-nights/{spectatorCode}/challenge-trades`

No host authorization header is required; anyone with the room code can request a trade, and the code does not verify player identity. Trades share the existing limit of 120 public score and trade mutations per IP and game night per 15 minutes. Request:

```json
{
  "firstParticipantId": "uuid",
  "secondParticipantId": "uuid",
  "idempotencyKey": "unique-request-id"
}
```

Response `200`: `{ "traded": true }`. The players must belong to the same non-null team and each have one unfinished challenge in the active game night. The request atomically swaps the player assignments while retaining the challenge records and timer state. Reject the trade with `409` if either timer is running, either challenge is unavailable, the participants are not teammates, or the idempotency key was used for a different operation/request. Repeating the same request with the same key does not swap them again.

## Read the game snapshot

`GET /functions/v1/game-nights/{spectatorCode}`

Response includes participants with team assignments, teams with derived totals, and challenge rounds with assigned participant IDs, completion status, and timer data. Keep existing fields for compatibility.

## Realtime and errors

Committed participant, team, score, and challenge-round changes publish the existing payload-free `state_changed` notification. Clients fetch a new snapshot as the authoritative state.

Errors preserve `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`. Expected codes include `UNAUTHORIZED`, `NOT_FOUND`, `DUPLICATE_PARTICIPANT`, `DUPLICATE_TEAM`, `NIGHT_COMPLETED`, `ROUND_ALREADY_ACTIVE`, `NO_UNUSED_CHALLENGES`, `INVALID_STATE_TRANSITION`, `NO_TEAMS`, `RATE_LIMITED`, `IDEMPOTENCY_KEY_REUSED`, `CHALLENGE_NOT_AVAILABLE`, `CHALLENGE_TIMER_RUNNING`, and `PLAYERS_NOT_TEAMMATES`.
