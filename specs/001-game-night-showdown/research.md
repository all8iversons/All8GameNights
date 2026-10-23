# Research: Game Night Showdown

## Decision 1: React application foundation

- **Decision**: Use React with TypeScript and Vite for a single web application.
- **Rationale**: React is explicitly requested. TypeScript supports safer modeling of game, score, challenge, and timer states. Vite provides a lightweight, established development and build workflow for a standalone React application.
- **Alternatives considered**:
  - A different UI framework was not selected because the request specified React.
  - A larger server-rendered framework was not selected because the feature is an interactive game display and does not require server-rendered public content.

## Decision 2: Shared persistence and live updates

- **Decision**: Use Supabase Postgres for durable records, Supabase Edge Functions for authorized writes, and transaction-triggered Supabase Realtime Broadcast notifications for connected viewers. After a notification, viewers fetch the authoritative game-night snapshot through the read contract.
- **Rationale**: Game nights, participants, scores, and challenge draws have clear relational relationships. Durable shared records support the historical leaderboard after the app is reopened. A managed realtime service avoids operating a custom websocket server. The database remains authoritative if clients reconnect or receive duplicate notifications.
- **Alternatives considered**:
  - Browser local storage is sufficient only for one browser/device; it cannot provide shared durable game state across viewers.
  - Firebase/Firestore is a valid managed alternative with realtime listeners and transactions, but its document model is less direct for event history and the per-night uniqueness invariant.
  - A custom websocket and database service would add deployment and operations work without a requirement that justifies it.

## Decision 3: Host and spectator access

- **Decision**: Avoid participant accounts. Give the host a high-entropy, read/write capability returned only when creating a game night; give viewers a separate opaque, read-only share code. Hash both capabilities before storage, validate host mutations in Edge Functions, and never expose privileged service credentials to the browser.
- **Rationale**: This preserves the low-friction game-night flow while separating authority to change scores from authority to view. A leaked spectator code must not grant host privileges. The host capability can be revoked by ending the event; rate-limit event creation and avoid logging capabilities.
- **Alternatives considered**:
  - Traditional accounts add signup and account-management flows that are not needed for a one-host event.
  - A single shared game link for both reading and writing would allow any viewer to change game state.
  - Browser-only checks are not an authorization boundary and cannot be used to protect writes.

## Decision 4: No repeated challenge draws

- **Decision**: Persist each selected challenge as a draw related to its game night. Enforce a unique database constraint on `(game_night_id, challenge_id)` and select/record a draw transactionally. Return an explicit exhausted-pool response when every available challenge has been drawn.
- **Rationale**: A UI-only exclusion list can be bypassed by reconnects, simultaneous requests, or concurrent tabs. A durable database invariant protects the requirement across all clients and retries. Resetting usage by starting a new game night naturally restores the complete catalog.
- **Alternatives considered**:
  - Client-side filtering alone cannot prevent races or duplicate selections.
  - Resetting selection history per round would contradict the requirement that a challenge cannot repeat during the same night.

## Decision 5: Timer and realtime recovery

- **Decision**: Store timer state and authoritative timestamps for each selected challenge round. Derive displayed remaining time from its deadline, and resynchronize the game-night snapshot after a viewer reconnects.
- **Rationale**: A timestamp-based deadline avoids timer drift from browser throttling or missed realtime messages. Persisted state gives host and viewers a consistent timer state. The client remains responsible for visual countdown rendering; server timestamps determine the actual expiry.
- **Alternatives considered**:
  - A client-local interval as the only source of truth drifts and diverges across devices.
  - A server push for every second would increase traffic without improving the authoritative countdown.

## References

- [Supabase Realtime: Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [MDN: BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
