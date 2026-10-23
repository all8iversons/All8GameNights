import { hashCapability } from '../_shared/capabilities.ts';
import { authorizeHost, serviceClient } from '../_shared/game-night-auth.ts';
import { HttpError } from '../_shared/http.ts';

export async function resolveNight(request: Request, spectatorCode: string) {
  const client = serviceClient();
  const isJoinCode = /^\d{6}$/.test(spectatorCode);
  const isLegacyCode = /^[a-f0-9]{64}$/i.test(spectatorCode);
  const codeHash = isJoinCode || isLegacyCode ? await hashCapability(spectatorCode) : '';
  const { data, error } = await client
    .from('game_nights')
    .select('id, status, created_at, started_at, completed_at')
    .eq('share_code_hash', codeHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { data: allowed, error: rateError } = await client.rpc('check_join_code_failure_rate', {
      p_ip: ip,
    });
    if (rateError) throw rateError;
    if (!allowed) {
      throw new HttpError(
        429,
        'RATE_LIMITED',
        'Too many invalid join-code attempts. Try again later.',
      );
    }
    throw new HttpError(404, 'NOT_FOUND', 'This game night could not be found.');
  }
  return { client, night: data };
}

export async function requireHost(request: Request, spectatorCode: string, allowCompleted = false) {
  const { client, night } = await resolveNight(request, spectatorCode);
  const authorized = await authorizeHost(request, night.id, client, allowCompleted);
  return { client, night, authorized };
}

export function mapParticipant(row: Record<string, unknown>) {
  return {
    id: row.id,
    gameNightId: row.game_night_id,
    displayName: row.display_name,
    score: row.score,
    teamId: row.team_id,
    createdAt: row.created_at,
  };
}

export function mapTeam(row: Record<string, unknown>, score = 0) {
  return {
    id: row.id,
    gameNightId: row.game_night_id,
    name: row.name,
    score,
    createdAt: row.created_at,
  };
}

export function mapRound(row: Record<string, unknown>) {
  const challenge = row.challenges as Record<string, unknown> | null;
  return {
    id: row.id,
    gameNightId: row.game_night_id,
    participantId: row.participant_id,
    challenge: challenge
      ? { id: challenge.id, name: challenge.name, instructions: challenge.instructions }
      : null,
    selectedAt: row.selected_at,
    finishedAt: row.finished_at,
    timerStatus: row.timer_status,
    durationSeconds: row.duration_seconds,
    deadlineAt: row.deadline_at,
    pausedRemainingSeconds: row.paused_remaining_seconds,
  };
}

export async function getSnapshot(
  client: ReturnType<typeof serviceClient>,
  night: Record<string, unknown>,
) {
  const [
    { data: participants, error: participantError },
    { data: teams, error: teamError },
    { data: rounds, error: roundError },
    { data: enabledChallenges, error: challengeError },
  ] = await Promise.all([
    client
      .from('participants')
      .select('*')
      .eq('game_night_id', night.id)
      .is('removed_at', null)
      .order('created_at'),
    client.from('teams').select('*').eq('game_night_id', night.id).order('created_at'),
    client
      .from('challenge_rounds')
      .select('*, challenges(id, name, instructions)')
      .eq('game_night_id', night.id)
      .order('selected_at'),
    client.from('challenges').select('id').eq('enabled', true),
  ]);
  if (participantError) throw participantError;
  if (teamError) throw teamError;
  if (roundError) throw roundError;
  const mappedParticipants = (participants ?? []).map(mapParticipant);
  const usedChallengeIds = new Set((rounds ?? []).map((round) => round.challenge_id));
  const enabledChallengeIds = (enabledChallenges ?? []).map(({ id }) => id);
  const teamScores = new Map<string, number>();
  for (const participant of mappedParticipants) {
    if (participant.teamId) {
      teamScores.set(
        participant.teamId,
        (teamScores.get(participant.teamId) ?? 0) + participant.score,
      );
    }
  }
  const highScore = Math.max(...mappedParticipants.map((participant) => participant.score));
  return {
    gameNight: {
      id: night.id,
      status: night.status,
      createdAt: night.created_at,
      startedAt: night.started_at,
      completedAt: night.completed_at,
      participants: mappedParticipants,
      teams: (teams ?? []).map((team) => mapTeam(team, teamScores.get(team.id) ?? 0)),
      challengeRounds: (rounds ?? []).map(mapRound),
      availableChallengeCount: enabledChallengeIds.length,
      unusedChallengeCount: enabledChallengeIds.filter((id) => !usedChallengeIds.has(id)).length,
      challengeCatalogAvailable: !challengeError,
      winners:
        night.status === 'completed'
          ? mappedParticipants
              .filter((participant) => participant.score === highScore)
              .map((participant) => ({
                displayName: participant.displayName,
                score: participant.score,
              }))
          : [],
    },
  };
}
