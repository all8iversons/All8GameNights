import { errorResponse, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { serviceClient } from '../_shared/game-night-auth.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    if (request.method !== 'GET') {
      return jsonResponse(
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported.' } },
        405,
      );
    }
    const client = serviceClient();
    const { data: nights, error } = await client
      .from('game_nights')
      .select('id, completed_at, participants(id, game_night_id, display_name, score, created_at)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (error) throw error;
    const entries = (nights ?? []).map((night) => {
      const participants = night.participants ?? [];
      const highScore = Math.max(...participants.map((player) => player.score));
      return {
        gameNightId: night.id,
        date: night.completed_at,
        participants: participants.map((player) => ({
          id: player.id,
          gameNightId: player.game_night_id,
          displayName: player.display_name,
          score: player.score,
          createdAt: player.created_at,
        })),
        winners: participants
          .filter((player) => participants.length > 0 && player.score === highScore)
          .map((player) => ({ displayName: player.display_name, score: player.score })),
      };
    });
    return jsonResponse({ entries });
  } catch (error) {
    return errorResponse(error);
  }
});
