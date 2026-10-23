# Feature Specification: Game Night Player Tools

**Feature Branch**: `002-game-night-player-tools`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "I would like to add the ability to add players after the game night has begun, I would like to be able to draw challenges per player, and to have a timer per player I would like to be able to place players into teams I would like players to be able to update their own scores"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Add players during a game (Priority: P1)

As a host, I want to add a player after a game night has started, so late arrivals can join without restarting the event.

**Why this priority**: A game night should accommodate players who arrive after play begins.

**Independent Test**: Start a game with at least one player, add another player, and verify the new player appears in the live standings with an initial score.

**Acceptance Scenarios**:

1. **Given** an active game night, **When** the host adds a valid player name, **Then** the player appears in the live board with a score of zero.
2. **Given** an active game night, **When** the host adds a blank or duplicate player name, **Then** the player is not added and the host sees a clear explanation.
3. **Given** a completed game night, **When** the host attempts to add a player, **Then** the game remains unchanged and the action is rejected.

### User Story 2 - Run individual challenges and timers (Priority: P1)

As a host, I want to draw a challenge for a specific player and manage that player's timer, so multiple players can work on their own challenge rounds.

**Why this priority**: Assigning challenges and timing separately for each player makes the game-night activities work for individuals and parallel play.

**Independent Test**: Start an active game with two players, draw a challenge for each, start and control each timer independently, and verify each player's challenge and remaining time are shown correctly.

**Acceptance Scenarios**:

1. **Given** an active game with unused challenges, **When** the host draws for a player, **Then** one unused challenge is assigned to that player and shown with its instructions.
2. **Given** two players with separate challenge rounds, **When** the host starts, pauses, resumes, or resets one player's timer, **Then** the other player's challenge and timer are unchanged.
3. **Given** a player with an unfinished challenge, **When** the host tries to draw a second challenge for that player, **Then** the draw is rejected until the current round is explicitly finished; resetting its timer alone does not finish the round.
4. **Given** all challenges have already been drawn in the game night, **When** the host requests another draw, **Then** the experience explains that no unused challenges remain.
5. **Given** a challenge timer reaches zero, **When** its duration expires, **Then** that player's round visibly signals that time is up without changing other players' timers.

### User Story 3 - Organize players into teams (Priority: P2)

As a host, I want to assign players to teams, so the live board shows both each player's score and how each team is doing.

**Why this priority**: Team play adds a shared competitive view while preserving individual performance and existing score history.

**Independent Test**: Create teams, assign players, update player scores, and verify each team total equals the sum of its members' scores.

**Acceptance Scenarios**:

1. **Given** an active game night, **When** the host creates teams and assigns players, **Then** the live board shows team membership and each team's summed score.
2. **Given** a player is reassigned to another team, **When** the board updates, **Then** both team totals reflect the player's current score in the new assignment.
3. **Given** a player is not assigned to a team, **When** team standings are shown, **Then** the player remains visible in individual standings and is not silently assigned to a team.
4. **Given** two teams have equal totals, **When** team standings are shown, **Then** the teams are shown as tied.
5. **Given** at least one team and one player, **When** the host randomizes teams, **Then** every player is randomly assigned across existing teams with team sizes differing by no more than one.
6. **Given** team standings are visible, **When** participants are assigned to teams, **Then** each team shows the names of its current members.

### User Story 4 - Let players submit their scores (Priority: P2)

As a player, I want to submit a score change using the spectator code and my player name, so a host does not have to enter every score update.

**Why this priority**: Player-submitted scoring reduces host workload and lets players keep play moving.

**Independent Test**: Join an active game using its spectator code, choose a participant name, submit a valid score change, and verify the individual and team standings update for all viewers.

**Acceptance Scenarios**:

1. **Given** an active game night and a valid spectator code, **When** a player submits an allowed score change for a listed player, **Then** the score and affected team total update on the live board.
2. **Given** an invalid player, invalid score change, or completed game night, **When** a score update is submitted, **Then** no score changes and the player receives a clear error.
3. **Given** the game night uses shared-code/name scoring, **When** someone has the spectator code, **Then** the experience makes clear that the code does not verify a player's identity and submissions may be made under any listed player's name.

### User Story 5 - Join with a short code (Priority: P1)

As a host, I want to share a six-digit numeric code, so players can join the live board without copying a long token.

**Independent Test**: Create a game night, verify its join code has six digits, join with that code, and verify repeated invalid code attempts are rate-limited.

**Acceptance Scenarios**:

1. **Given** a newly created game night, **When** the host shares its join code, **Then** it is exactly six numeric digits and opens the correct game night.
2. **Given** an existing game night created with a legacy long code, **When** a viewer enters that code, **Then** the viewer can still join.
3. **Given** an IP address repeatedly submits invalid join codes, **When** it exceeds the allowed attempts, **Then** additional attempts are rate-limited.
4. **Given** a six-digit code is also used for casual score submissions, **When** someone has or guesses that code, **Then** the existing disclosure remains visible and score changes remain rate-limited.

### User Story 6 - Generate teams with a chosen size (Priority: P2)

As a host, I want to set either the number of teams or players per team and have balanced teams generated with random names from the shared pool, so I can quickly organize the roster.

**Independent Test**: Generate teams for a roster using both sizing modes, verify the player counts and names, and confirm player scores are unchanged and previous teams are replaced.

**Acceptance Scenarios**:

1. **Given** a roster and no existing teams, **When** the host chooses a team count, **Then** that many uniquely named teams are created and all players are randomly assigned as evenly as possible.
2. **Given** a roster and existing teams, **When** the host chooses players per team, **Then** enough newly named teams are created, each team has at most the requested number of players, and the last team may be smaller.
3. **Given** existing teams and player scores, **When** the host generates teams, **Then** the existing teams and assignments are replaced atomically while individual player scores remain unchanged.
4. **Given** an invalid count or empty roster, **When** the host requests team generation, **Then** no team or assignment changes are committed and a clear validation error is shown.

### User Story 7 - Trade unfinished challenges with a teammate (Priority: P2)

As a player, I want to swap my unfinished challenge with a teammate's unfinished challenge, so our team can rebalance its current challenges without drawing new ones.

**Why this priority**: Teammates can adapt their current challenges while preserving the shared challenge pool and round history.

**Independent Test**: Give two teammates unfinished challenges, trade them, and verify the assignments swap exactly once. Verify players on different teams and players with a running timer cannot trade.

**Acceptance Scenarios**:

1. **Given** two players on the same team each have an unfinished challenge, **When** either requests a trade, **Then** their challenge assignments swap without drawing new challenges or changing timer state.
2. **Given** either challenge timer is running, **When** a trade is requested, **Then** the trade is rejected and the board explains that both timers must be paused or stopped.
3. **Given** the players are on different teams or either has no unfinished challenge, **When** a trade is requested, **Then** no assignment changes and a clear error is returned.
4. **Given** a trade request is retried with the same idempotency key, **When** the retry is processed, **Then** the assignments remain swapped only once.
5. **Given** someone has the shared room code, **When** they request a same-team trade, **Then** the interface discloses that the room code does not verify player identity.

### User Story 8 - Remove a player from a game night (Priority: P2)

As a host, I want to remove a player who is no longer participating, so the active roster and board show only current players.

**Independent Test**: Remove a player with an active challenge and verify that the player leaves the active roster, their timer stops, and their score and challenge history remain preserved.

**Acceptance Scenarios**:

1. **Given** a game night is in setup or active play, **When** the host confirms removal of a player, **Then** the player is excluded from the active roster and standings.
2. **Given** the removed player has an unfinished challenge, **When** removal succeeds, **Then** the challenge round is finished and any running timer is stopped while its history remains preserved.
3. **Given** a player has been removed, **When** a score or challenge action targets that player, **Then** the action is rejected and no state changes.
4. **Given** a player has been removed, **When** a new player with the same name is added, **Then** the new player is distinct and the removed player's history remains intact.

### User Story 9 - Manage the shared challenge catalog (Priority: P2)

As a host, I want to add, edit, and disable challenges, so the challenge pool can be maintained without direct database access.

**Independent Test**: Add a challenge, edit an already-assigned challenge, and disable a challenge; verify edits appear on its current assignment and disabled challenges are excluded from future draws.

**Acceptance Scenarios**:

1. **Given** a host opens challenge management, **When** the catalog loads, **Then** the host can see each shared challenge and its enabled state.
2. **Given** a valid challenge name and instructions, **When** the host adds it, **Then** it is available for future draws.
3. **Given** a challenge is already assigned, **When** the host edits its name or instructions, **Then** the current assignment immediately displays the updated details.
4. **Given** a host disables a challenge, **When** a future challenge is drawn, **Then** that challenge is not selected; existing assignments and history are preserved.
5. **Given** a viewer or unauthorized caller attempts catalog management, **When** they request or change the catalog, **Then** the operation is rejected.

### User Story 10 - View a dense host board (Priority: P2)

As a host, I want a compact wide-screen board, so I can monitor a large roster and their challenges at a glance.

**Independent Test**: Start a game with 20 players, open wide-screen mode, and verify that all players, scores, assigned challenges, and timers fit the responsive multi-column board.

**Acceptance Scenarios**:

1. **Given** a host opens wide-screen mode on a desktop display, **When** up to 20 players are in the roster, **Then** the board uses compact responsive columns and keeps each player's score line beside their player card.
2. **Given** a host exits wide-screen mode, **When** the regular board is shown, **Then** its existing layout remains available.

### User Story 11 - Undo the latest challenge finish (Priority: P2)

As a host, I want to undo finishing a player's latest challenge, so an accidental finish can be corrected without losing its round history.

**Independent Test**: Finish a player's latest round and undo it; verify the same round remains assigned, becomes unfinished with a ready timer, and cannot be undone if it is older than another round or another round is unfinished.

**Acceptance Scenarios**:

1. **Given** a player's most recently selected challenge is finished and they have no unfinished round, **When** the host undoes the finish, **Then** that same round remains in history, becomes unfinished, and its timer returns to ready with no running deadline.
2. **Given** a later challenge exists or the player already has an unfinished challenge, **When** the host tries to undo an older finish, **Then** the operation is rejected and all rounds remain unchanged.
3. **Given** the game night is completed, **When** the host attempts to undo a finish, **Then** the operation is rejected.

### User Story 12 - Rename a player in the current game (Priority: P2)

As a host, I want to rename a participant in the current game night, so the board can reflect a correction or preferred display name without changing unrelated game history.

**Independent Test**: Rename a current participant and verify the live snapshot updates; verify duplicate names, unauthorized requests, and completed game nights are rejected.

**Acceptance Scenarios**:

1. **Given** a setup or active game night, **When** the host saves a valid new name, **Then** only that game-night participant is renamed and the live board reflects it.
2. **Given** the new name is blank, too long, or already used by another active participant, **When** the host saves it, **Then** the request fails without changing the participant.
3. **Given** a viewer or a completed game night, **When** a rename is requested, **Then** the request is rejected.

### User Story 13 - Open a separate display-only board (Priority: P2)

As a host, I want to open or share a display-only game board, so a separate monitor can show the live widescreen view without exposing host or score controls.

**Independent Test**: Open the host-provided display link in a second browser tab with a saved host session and verify the tab loads the live widescreen board without recovering host privileges or rendering mutation controls.

**Acceptance Scenarios**:

1. **Given** a host is viewing a game night, **When** they open the display-only board link, **Then** the separate page loads that game night directly in widescreen mode.
2. **Given** a viewer enters a join code, **When** they choose **Join display-only**, **Then** the board opens directly in widescreen mode.
3. **Given** a display-only URL is opened in a browser with a saved host session, **When** the board loads, **Then** it does not restore host privileges or expose host, scoring, challenge, or timer controls.
4. **Given** the game state changes, **When** the display-only board receives live updates, **Then** standings, challenges, and timer states update without user interaction.

### User Story 14 - Manage shared content without a game night (Priority: P1)

As an application administrator, I want to manage the shared challenge catalog and random team-name pool from the app outside a game night, so I can maintain reusable game content without creating a temporary room.

**Independent Test**: Open global content management before creating a game, authenticate with the server-configured admin password, add/edit/archive a challenge, and add/edit/remove a random team name; verify unauthenticated requests fail and future generated teams use the updated pool.

**Acceptance Scenarios**:

1. **Given** no game night is active, **When** an administrator opens global content management with the configured admin password, **Then** they can list and add or edit challenges and random team names.
2. **Given** a challenge is no longer wanted for future games, **When** the administrator archives it, **Then** it is unavailable for future draws while existing assignments and game history remain intact.
3. **Given** a team name is added, edited, or removed from the pool, **When** a host later generates teams, **Then** only names currently in the pool are used; existing game-night team names do not change.
4. **Given** a missing or invalid admin password, **When** a global content operation is requested, **Then** it is rejected and no content changes.
5. **Given** global administration is not configured with a strong server-side secret, **When** the management endpoint is called, **Then** the operation is unavailable and does not fall back to public access.

### Edge Cases

- Two hosts try to add players with the same name at nearly the same time; only one succeeds and the other receives a duplicate-name message.
- A removed player's unfinished timer is stopped and the round history remains retained; the removed player is not included in active roster operations or standings.
- A host edits or disables a challenge that is already assigned; the history remains consumed and any edit is reflected immediately in the assignment.
- A player is added after team assignments already exist; the new player is unassigned until the host assigns them.
- A host cancels a replacement challenge confirmation or has no unused challenges available; the player's unfinished round and timer remain unchanged.
- Two players request a challenge at the same time when only one unused challenge remains; it is assigned at most once and the other request receives the no-challenges-remaining response.
- A team has no members; it remains visible with a total of zero or can be removed by the host.
- A team or player name is blank, too long, or duplicated within the relevant game night; the change is rejected with clear guidance.
- One player's timer expires while another player's timer is running or paused; only the expired timer changes state.
- A player submits a score change while the host also changes that player's score; the final value reflects both accepted changes without losing either.
- A client reconnects after a score, team, or round update; it reloads the authoritative current state.
- A score submission uses the spectator code; as chosen for casual play, anyone with that code may submit under any player's name.
- An older finished challenge is not eligible for undo when a later round exists, even if that later round is also finished.
- Undoing the most recent finish is rejected if any unfinished challenge already exists for that participant.
- Renaming a participant does not modify a similarly named player in another game night or previously completed game records.
- Opening the display-only link in a browser that also has host credentials stored must not restore or display those host privileges.
- The global admin password is server-side configuration, never bundled into browser assets or stored in browser persistence; management remains unavailable until a valid secret is configured.
- Archiving an assigned challenge preserves its name and instructions in existing history.
- Removing or editing a random team name affects future generated teams only and never renames teams already created in a game night.
- Removing every random team name disables team generation with a clear error until an administrator adds a name.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The host MUST be able to add a named player to a game night in setup or active status.
- **FR-002**: The system MUST initialize each added player's score to zero and include the player in the live individual standings.
- **FR-003**: The system MUST reject blank or duplicate player names and MUST provide an actionable message; player names MUST be trimmed and contain 1-40 characters.
- **FR-004**: The host MUST be able to create, rename, and remove teams during setup or active play; team names MUST be trimmed and contain 1-40 characters and be unique without regard to case within the game night.
- **FR-005**: The host MUST be able to assign each player to at most one team and change or remove that assignment during setup or active play.
- **FR-006**: The live board MUST show individual scores and team totals equal to the sum of assigned members' scores; unassigned players MUST remain in individual standings.
- **FR-007**: The host MUST be able to draw an unused challenge for a selected player during an active game night.
- **FR-008**: At most one unfinished challenge round MAY be assigned to a player at a time. The host MAY issue a replacement after confirming; replacement MUST finish the existing round, stop its timer, and retain its history. If no unused challenge is available, the existing round MUST remain unchanged. Resetting a timer MUST NOT finish its round.
- **FR-009**: A challenge MUST NOT be drawn more than once during a game night, regardless of which player it is assigned to.
- **FR-010**: The host MUST be able to independently start, pause, resume, reset, and finish each player's challenge timer without changing another player's round or timer.
- **FR-011**: The live board MUST show each assigned player's challenge, instructions, timer state, and time remaining, and MUST signal that player's timer expiration.
- **FR-012**: A player MUST be able to submit a score change for a listed player by providing the game-night spectator code and selecting the player's name, while the game night is active.
- **FR-013**: Score submission MUST validate the game-night status, player membership, and a non-zero whole-number score delta between -10,000 and 10,000 inclusive and MUST return a clear error for rejected submissions.
- **FR-014**: The player-scoring interface MUST state that the spectator code is shared and does not verify the submitter's identity; anyone with the code can submit a change under any player's name.
- **FR-015**: Accepted score changes MUST update the individual's standings and the corresponding team total for all connected viewers within one second.
- **FR-016**: The system MUST preserve players, team assignments, scores, challenge assignments, and timer state across reconnections and reloads.
- **FR-017**: Completed game nights MUST reject player additions, team changes, challenge changes, timer changes, and score submissions.
- **FR-018**: Failures to save or synchronize player, team, challenge, timer, or score changes MUST be visible to the user and MUST NOT be presented as successful.
- **FR-019**: The host MUST be able to randomly distribute all players across the existing teams in a single operation; resulting team sizes MUST differ by no more than one, and the operation MUST be atomic.
- **FR-020**: Newly created game nights MUST receive a unique six-digit numeric join code; previously issued long codes MUST remain usable.
- **FR-021**: Invalid join-code attempts MUST be rate-limited by source IP, and public score submissions MUST remain rate-limited.
- **FR-022**: Team standings MUST display the names of all players assigned to each team and clearly indicate when a team has no assigned players.
- **FR-023**: The host MUST be able to generate teams by specifying either the number of teams or players per team; players MUST be distributed randomly and evenly, generated teams MUST use unique names from the administrator-managed pool (adding a numeric suffix if more teams than pool entries are needed), and existing teams MUST be replaced atomically without changing individual scores.
- **FR-024**: The host MUST be able to remove an active player during setup or play; removal MUST preserve scores and challenge history, stop and finish any unfinished round, and exclude the player from active roster operations and standings.
- **FR-025**: The host MUST be able to list, add, edit, enable, and disable challenges in the shared catalog; unauthorized viewers MUST NOT manage the catalog, and edits MUST be reflected immediately in current assignments.
- **FR-026**: Disabled challenges MUST be excluded from future draws without deleting existing challenge history or making already-assigned challenges available again.
- **FR-027**: The host MUST be able to toggle a dense wide-screen board that displays up to 20 players with score lines beside their cards in responsive columns.
- **FR-028**: When a player has an unfinished challenge, the host MUST be asked to confirm before issuing a replacement challenge; cancelling MUST leave the current challenge and timer unchanged.
- **FR-029**: Wide-screen mode MUST be a read-only display for public viewing: it MUST hide score-adjustment, challenge issue/trade, and timer start/pause/resume/reset/finish controls while continuing to show live scores, challenges, and timer state.
- **FR-030**: Wide-screen mode MUST hide the full-deck informational message and the ready-state "Ready when you are" timer message to reduce visual clutter; active, paused, and expired timer states remain visible.
- **FR-031**: In wide-screen mode, each player's score MUST appear in the upper-right corner of their challenge card, and the "Bonus round" label MUST be omitted.
- **FR-032**: During an active game, the host MUST be able to undo the finish of a player's most recently selected challenge only when that player has no unfinished challenge; the round MUST remain in history and return to unfinished `ready` timer state.
- **FR-033**: The host MUST be able to rename a participant in setup or active play; names MUST be trimmed, contain 1-40 characters, and remain unique among active participants in that game night. Renaming MUST affect only the current game-night participant.
- **FR-034**: A viewer MUST be able to join directly into a display-only widescreen board using the join code or a host-provided display link. This view MUST NOT restore host credentials from browser storage or expose score, challenge, timer, or game-management controls.
- **FR-035**: An administrator MUST be able to manage the shared challenge catalog and random team-name pool without creating or joining a game night, using a server-configured password with at least 32 characters that is never exposed in browser configuration or persistent browser storage.
- **FR-036**: Global challenge management MUST support add, edit, and archive operations. Archiving MUST disable future draws without removing a challenge referenced by current assignments or historical rounds.
- **FR-037**: Global team-name management MUST support listing, adding, editing, and removing names from the pool used by future randomized team generation; existing game-night teams MUST remain unchanged.
- **FR-038**: Global content endpoints MUST reject missing or invalid admin credentials and MUST NOT permit writes when the server admin password is unconfigured or too weak.

### Key Entities

- **Player**: A named game-night participant with an individual score and optional team assignment.
- **Team**: A named group of players with a total derived from its assigned members' individual scores.
- **Challenge round**: A unique challenge assigned to one player, including its completion state and timer controls.
- **Player score submission**: A score change submitted using the shared spectator code and a selected player name; it is not an identity-verified action.
- **Game night**: The event that owns its players, teams, scores, challenge rounds, and status.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A host can add a player to an active game and see that player appear in the standings within 10 seconds.
- **SC-002**: A host can assign a challenge and independently start its timer for a selected player in under 30 seconds.
- **SC-003**: When two players have active rounds, a timer action on one player leaves the other player's timer state unchanged in 100% of tested cases.
- **SC-004**: Team totals match the sum of assigned player scores after every accepted score update in 100% of tested cases.
- **SC-005**: 95% of accepted player score submissions appear in connected viewers' standings within one second.
- **SC-006**: Invalid or unauthorized-state changes provide a visible error and do not alter saved game-night state in 100% of tested cases.
- **SC-007**: A viewer can join with a six-digit code, and repeated invalid code attempts are throttled; randomizing players assigns the full roster with team sizes balanced to within one player.
- **SC-008**: A host can generate the requested team count or player capacity in one action, see all players assigned to balanced teams, and retain every individual score.
- **SC-009**: A host can remove a player and see the active roster update while the player's score and challenge history remain preserved and any unfinished timer is stopped.
- **SC-010**: A host can add and edit shared challenges; an edited challenge appears with its updated details on any existing assignment, and a disabled challenge is unavailable for future draws.
- **SC-011**: Wide-screen mode displays all 20 players in a compact, responsive multi-column layout with each score line beside its player card.
- **SC-012**: A host can confirm replacement of a player's unfinished challenge, and the next challenge appears while the prior round remains in history with its timer stopped; cancelling confirmation leaves the current round unchanged.
- **SC-013**: In wide-screen mode, score changes, challenge issue/trade, and timer control buttons are absent; timer displays remain visible at 30px or smaller, and the normal host controls return when wide-screen mode is exited.
- **SC-014**: Wide-screen mode contains no full-deck or ready-state timer message, while those messages return in the regular board view.
- **SC-015**: Every wide-screen player card displays that player's score in its top-right heading area and does not display the "Bonus round" label.
- **SC-016**: Undoing the latest eligible challenge finish restores the same round to unfinished `ready` state without deleting its history, while attempts against older rounds or a participant with another unfinished round are rejected without mutation.
- **SC-017**: A valid host rename updates the current game's participant snapshot; duplicate, unauthorized, invalid, and completed-game rename attempts leave saved data unchanged.
- **SC-018**: A display-only board opens directly in widescreen mode, receives live updates, and exposes no mutation controls, including when host credentials are stored in the same browser.
- **SC-019**: Before creating any game night, an administrator can authenticate and manage challenges and random team names; unauthenticated requests and invalid content are rejected without mutation.
- **SC-020**: Archiving a challenge preserves its existing assignments and history while preventing future draws, and generated team names reflect the current managed pool without changing teams in existing game nights.

## Assumptions

- The six-digit join code is the entry point for viewers and casual player score submissions; existing long codes remain valid for game nights created before this change.
- Individual scores remain the source of truth; team totals are derived and do not replace or duplicate player scores.
- A challenge is unique across the entire game night, even when assigned to different players.
- Each player can have only one unfinished challenge at a time; different players may run independent rounds and timers concurrently.
- Removing a player is a soft removal: historical records remain stored, but the player is omitted from active rosters and standings and cannot receive further score or challenge mutations.
- Challenges are shared across game nights. Catalog edits apply immediately, including to current assignments; disabling affects future draws only and does not delete challenge history.
- Player-submitted scores use the casual-play trust model selected by the user: possession of the spectator code permits submission under any player's name. The interface must disclose this; it is not authentication.
- Existing completed-game history continues to represent individual player results. Team history enhancements beyond recording current team totals are not included unless needed to preserve current behavior.
