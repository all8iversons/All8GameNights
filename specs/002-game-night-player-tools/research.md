# Research: Game Night Player Tools

## Existing project patterns

### Decision: Extend the current Edge Function and snapshot API

**Rationale**: The project already routes game-night operations through Supabase Edge Functions, uses a centralized game-night snapshot, stores authoritative timer deadlines, and sends payload-free realtime notifications after database changes. Extending these paths preserves one source of truth and avoids a second client/server integration.

**Alternatives considered**: Direct frontend database writes were rejected because existing tables deny anonymous writes and the project keeps privileged authorization on the server.

### Decision: Use additive database constraints and transactional operations

**Rationale**: Existing challenge draws and score increments use database functions to serialize updates and prevent duplicate/replayed mutations. Player-scoped rounds require equivalent guarantees for unique per-night challenge draws, one unfinished round per player, and atomic score increments.

**Alternatives considered**: UI-only checks were rejected because concurrent clients could race and bypass them.

### Decision: Preserve individual scores and derive team totals

**Rationale**: Existing score updates, winner calculation, and history use participant scores. Deriving team totals from assigned participants supports both individual and team standings without competing sources of score truth.

**Alternatives considered**: A separate team score was rejected because it could diverge from player scores and create ambiguous historical results.

### Decision: Use the spectator code for casual player score submissions

**Rationale**: The user selected shared spectator code plus player name, and confirmed the casual-play impersonation tradeoff. The API must still validate active game state, participant membership, score deltas, and idempotency, and the UI must clearly disclose that a name is not verified.

**Alternatives considered**: Per-player PINs and host approval were offered and declined.

### Decision: Use six-digit numeric join codes with failed-attempt throttling

**Rationale**: A six-digit code is easier to share verbally. It has less entropy than the previous long code, so failed lookups are limited to 10 per source IP per 15-minute window. The existing high-entropy host capability remains independent, and legacy long codes continue to work.

**Alternatives considered**: Keeping the long opaque code was rejected in favor of the requested easy-to-share code. The shared-code score-submission tradeoff is retained as explicitly selected for casual play.

### Decision: Randomize team assignments atomically and evenly

**Rationale**: One server-side transaction shuffles the whole roster and assigns players round-robin across a randomized order of existing teams. This avoids partially updated rosters and ensures team sizes differ by at most one.

**Alternatives considered**: Individual browser requests were rejected because failures could leave a partially randomized roster.

### Decision: Generate teams by team count or team capacity

**Rationale**: Hosts can choose either a precise number of evenly balanced teams or a maximum players-per-team capacity. A single database transaction replaces the prior team setup, randomly assigns every player, and retains individual scores. Generated names use an original space theme rather than names from an existing franchise.

**Alternatives considered**: Appending generated teams to manually created teams was rejected because the host explicitly chose replacement semantics. Repeated client-side mutations were rejected because they could leave partial assignments.

### Decision: Soft-remove participants and preserve history

**Rationale**: Hosts can remove departed players from the live board without erasing scores, challenge rounds, or already-consumed challenges. A soft-removal timestamp lets snapshots and mutations distinguish historical participants from the current roster, and removal atomically finishes and stops any unfinished timer.

**Alternatives considered**: Hard deletion was rejected because it would destroy game history and could make consumed challenges available again.

### Decision: Restrict challenge-finish undo to the latest eligible round

**Rationale**: Undoing an older finish could reopen a round out of sequence or violate the one-unfinished-round-per-player invariant. A database transaction locks the game night, verifies the target is the participant's most recent round and no other round is unfinished, then clears the finish timestamp and returns the timer to `ready` without deleting history.

**Alternatives considered**: Reopening any finished round or deleting and redrawing were rejected because they can reorder a player's history or consume a different challenge than the one the host intended to restore.

### Decision: Rename only the participant record in the current game night

**Rationale**: The app has game-night participant records rather than global player accounts. A host rename updates only that participant, is allowed during setup or active play, and remains subject to the active-name uniqueness constraint. It does not alter a person or participant record in another game night.

**Alternatives considered**: Global player profiles were rejected because they would add identity management outside the requested current-game correction.

### Decision: Manage one shared challenge catalog

**Rationale**: Catalog entries are shared across events. Host-authorized list, create, edit, and enable/disable operations let hosts maintain that common pool; edits immediately change details shown by existing assignments, while disabling only affects future draws.

**Alternatives considered**: Per-game-night catalogs and deleting assigned challenges were rejected to retain the existing shared catalog and challenge-history semantics.

### Decision: Use a dense multi-column host board

**Rationale**: Score lines beside compact player cards reduce vertical height while responsive columns allow a host to monitor up to 20 players on a wide display. The existing regular board remains available outside wide-screen mode.

**Alternatives considered**: Increasing card density without aligning scores or splitting into columns was rejected because it does not solve the 20-player monitoring requirement.

### Decision: Open the wide-screen board as an independent, read-only display

**Rationale**: A direct display URL and a separate display-only join choice let a second browser or monitor load the game without depending on the host tab's local UI state. The display route deliberately bypasses stored host-session restoration and passes no host capability to the game board, while reusing the existing live snapshot and read-only wide-screen presentation.

**Alternatives considered**: Requiring the host to keep wide-screen mode in the same tab was rejected because it prevents using a separate monitor. Reusing a browser's stored host capability was rejected because the public display must not expose host controls.

### Decision: Give each player at most one unfinished round

**Rationale**: This is the selected behavior. A player may receive another unused challenge after their current round is explicitly finished; each player's timer remains independent from other players.

**Alternatives considered**: Multiple simultaneous rounds per player were offered and declined.

## No unresolved technical-context questions

The repository and user decisions specify the data store, authorization pattern, state ownership, and concurrency behavior needed for implementation.
