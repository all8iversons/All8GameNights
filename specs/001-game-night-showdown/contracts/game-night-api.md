# Game Night API Contract

This contract defines the browser-to-backend behavior. All host mutations are handled by server-side functions; the browser must not write directly to protected tables. Requests and responses use JSON over HTTPS.

## Capabilities

- **Host capability**: High-entropy bearer value returned once when a night is created. The host sends it in the `Authorization` header for mutations. It is not placed in a share link or logged. Stored only as a hash by the service.
- **Spectator capability**: Separate opaque read-only value returned at creation and shared with viewers. It can read the event and subscribe to update notifications but cannot mutate state.
- Capability comparisons and status checks happen on the server. Reject host mutations for completed nights.

## Operations

### Create a game night

`POST /functions/v1/game-nights`

Request:

```json
{}
```

Response `201`:

```json
{
  "gameNight": {
    "id": "uuid",
    "status": "setup",
    "createdAt": "ISO-8601 timestamp"
  },
  "hostCapability": "opaque-secret-returned-once",
  "spectatorCode": "opaque-read-only-code"
}
```

The host capability is returned only at creation. Creation is rate-limited.

### Add a participant

`POST /functions/v1/game-nights/{spectatorCode}/participants`

Host authorization required. Participants can be added only while the night is in setup. Request:

```json
{
  "displayName": "Player name"
}
```

Response `201`: the created participant with `id`, `displayName`, and `score: 0`.

### Start a game night

`POST /functions/v1/game-nights/{spectatorCode}/start`

Host authorization required. The night must be in setup and contain at least one participant. Response `200` contains the active game-night snapshot and its `startedAt` timestamp. Reject an empty roster with `400`; reject a night that has already started or completed with `409`.

### Read the current game

`GET /functions/v1/game-nights/{spectatorCode}`

Read-only access. Response `200` contains game-night status, participant names and scores, selected challenge rounds, and timer state sufficient for rendering the current display. A `404` indicates an invalid or unavailable spectator code.

### Change a score

`POST /functions/v1/game-nights/{spectatorCode}/participants/{participantId}/score`

Host authorization required. Request:

```json
{
  "delta": 100,
  "idempotencyKey": "unique-request-id"
}
```

`delta` must be a non-zero integer. Apply the increment atomically to the stored score. Response `200` contains the updated participant and score. A repeated request with the same idempotency key returns the original result without applying the score change twice.

### Draw a challenge

`POST /functions/v1/game-nights/{spectatorCode}/challenge-draws`

Host authorization required. Request:

```json
{
  "idempotencyKey": "unique-request-id"
}
```

Response `201` contains the selected challenge round and challenge name/instructions. A repeated request with the same idempotency key returns the same draw. The service serializes draws for a night, chooses and records an unused enabled challenge in one transaction, and enforces the database uniqueness constraint on night and challenge. Drawing a new challenge stops any currently running challenge timer before presenting the new round. Return `409` with code `NO_UNUSED_CHALLENGES` when all enabled challenges have been selected that night. Do not create a repeated draw.

### Control a challenge timer

`POST /functions/v1/game-nights/{spectatorCode}/challenge-rounds/{roundId}/timer`

Host authorization required. Request:

```json
{
  "action": "start",
  "durationSeconds": 60
}
```

Supported actions are `start`, `pause`, `resume`, and `reset`. `durationSeconds` is required and must be positive for `start`; it is ignored for other actions. Response `200` contains the updated timer state and authoritative timestamps/remainder. Reject invalid state transitions with `409`.

### Complete a game night

`POST /functions/v1/game-nights/{spectatorCode}/complete`

Host authorization required. Response `200` contains the completed status, final participant scores, and all winner(s). Completion is atomic and idempotent; a retry with the same valid host capability returns the existing completed result without mutation. Reject nights without participants; after completion reject all other mutations with `409`.

### Read historical results

`GET /functions/v1/leaderboard`

Read-only access. Response `200` returns completed game nights ordered newest first, each with its date, final participant scores, and all tied winner(s). Return an empty array when no game nights are complete.

## Live update behavior

- Each committed game-night, participant, or challenge-round change publishes a payload-free `state_changed` notification to a channel identified by the hash of the spectator code.
- The channel topic uses the hash of the spectator code so the raw code is not exposed in channel metadata. The channel is a notification mechanism, not an authorization boundary. Notifications may be forged and contain no authoritative data; viewers fetch the current snapshot after receiving one.
- On initial load and after reconnect, viewers fetch a fresh snapshot so missed notifications cannot leave stale scores or timer state.
- The UI coalesces and rate-limits snapshot refreshes triggered by notifications, and handles transient connection errors without presenting an unconfirmed mutation as successful.

## Error shape

Errors use a stable JSON shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A positive timer duration is required."
  }
}
```

Expected codes include `VALIDATION_ERROR` (`400`), `UNAUTHORIZED` (`401`), `NOT_FOUND` (`404`), `NO_UNUSED_CHALLENGES` (`409`), `NIGHT_COMPLETED` (`409`), `INVALID_STATE_TRANSITION` (`409`), and `RATE_LIMITED` (`429`). Error messages must not contain secrets or internal stack details.
