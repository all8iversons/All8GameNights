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

### Decision: Give each player at most one unfinished round

**Rationale**: This is the selected behavior. A player may receive another unused challenge after their current round is explicitly finished; each player's timer remains independent from other players.

**Alternatives considered**: Multiple simultaneous rounds per player were offered and declined.

## No unresolved technical-context questions

The repository and user decisions specify the data store, authorization pattern, state ownership, and concurrency behavior needed for implementation.
