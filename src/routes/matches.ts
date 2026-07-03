import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import type { Match, MatchWithTeams, MatchStat, ApiResponse } from '../types/index.js';

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/matches
   * Returns all matches with home/away team names joined in.
   */
  app.get<{ Reply: ApiResponse<MatchWithTeams[]> }>('/api/matches', async (_req, reply) => {
    try {
      const rows = await sql<MatchWithTeams[]>`
        SELECT
          m.id,
          m.round,
          m.home_team_id,
          m.away_team_id,
          m.date,
          m.home_score,
          m.away_score,
          m.status,
          row_to_json(ht.*) AS home_team,
          row_to_json(at.*) AS away_team
        FROM matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        ORDER BY m.date ASC NULLS LAST, m.id ASC
      `;
      return reply.code(200).send({ statusCode: 200, data: rows });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch matches' });
    }
  });

  /**
   * GET /api/matches/:id
   * Returns a single match with team info and all player stats.
   */
  app.get<{ Params: { id: string }; Reply: ApiResponse<MatchWithTeams & { stats: MatchStat[] }> }>(
    '/api/matches/:id',
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return reply.code(400).send({ statusCode: 400, error: 'Invalid match id' });
      }

      try {
        const [match] = await sql<MatchWithTeams[]>`
          SELECT
            m.id,
            m.round,
            m.home_team_id,
            m.away_team_id,
            m.date,
            m.home_score,
            m.away_score,
            m.status,
            row_to_json(ht.*) AS home_team,
            row_to_json(at.*) AS away_team
          FROM matches m
          LEFT JOIN teams ht ON ht.id = m.home_team_id
          LEFT JOIN teams at ON at.id = m.away_team_id
          WHERE m.id = ${id}
        `;

        if (!match) {
          return reply.code(404).send({ statusCode: 404, error: 'Match not found' });
        }

        const stats = await sql<MatchStat[]>`
          SELECT * FROM match_stats WHERE match_id = ${id}
        `;

        return reply.code(200).send({ statusCode: 200, data: { ...match, stats } });
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch match' });
      }
    },
  );
}
