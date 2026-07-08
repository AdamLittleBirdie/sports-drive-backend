import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import type { Match, MatchWithTeams, MatchStat, AllMatch, ApiResponse } from '../types/index.js';

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

  /**
   * GET /api/all-matches
   * Returns all matches from all sports (AFL, Football, Basketball) combined.
   * Includes sport type so frontend can identify which sport each match is from.
   */
  app.get<{ Reply: ApiResponse<AllMatch[]> }>('/api/all-matches', async (_req, reply) => {
    try {
      // Fetch AFL matches (Regular Season only)
      const aflMatches = await sql<AllMatch[]>`
        SELECT 
          m.id, m.round, m.home_team_id, m.away_team_id, m.date, 
          m.home_score, m.away_score, m.status,
          row_to_json(ht.*) AS home_team,
          row_to_json(at.*) AS away_team,
          'AFL' AS sport
        FROM matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        WHERE m.round = 'Regular Season'
        ORDER BY m.date DESC NULLS LAST
      `;

      // Fetch World Cup matches (non-Regular Season rounds)
      const worldCupMatches = await sql<AllMatch[]>`
        SELECT 
          m.id, m.round, m.home_team_id, m.away_team_id, m.date, 
          m.home_score, m.away_score, m.status,
          row_to_json(ht.*) AS home_team,
          row_to_json(at.*) AS away_team,
          'World Cup' AS sport
        FROM matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        WHERE m.round != 'Regular Season'
        ORDER BY m.date DESC NULLS LAST
      `;

      // Fetch Football matches (Premier League, La Liga, Champions League, World Cup)
      const footballMatches = await sql<AllMatch[]>`
        SELECT 
          fm.id, fm.round, fm.home_team_id, fm.away_team_id, fm.date,
          fm.home_score, fm.away_score, fm.status,
          row_to_json(ft.*) AS home_team,
          row_to_json(at.*) AS away_team,
          'Football' AS sport
        FROM football_matches fm
        LEFT JOIN football_teams ft ON ft.id = fm.home_team_id
        LEFT JOIN football_teams at ON at.id = fm.away_team_id
        ORDER BY fm.date DESC NULLS LAST
      `;

      // Fetch Basketball matches (NBA)
      const basketballMatches = await sql<AllMatch[]>`
        SELECT 
          bm.id, bm.round, bm.home_team_id, bm.away_team_id, bm.date,
          bm.home_score, bm.away_score, bm.status,
          row_to_json(bt.*) AS home_team,
          row_to_json(at.*) AS away_team,
          'Basketball' AS sport
        FROM basketball_matches bm
        LEFT JOIN basketball_teams bt ON bt.id = bm.home_team_id
        LEFT JOIN basketball_teams at ON at.id = bm.away_team_id
        ORDER BY bm.date DESC NULLS LAST
      `;

      // Combine and sort by date (most recent first)
      const allMatches = [...aflMatches, ...worldCupMatches, ...footballMatches, ...basketballMatches]
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

      return reply.code(200).send({ statusCode: 200, data: allMatches });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch matches' });
    }
  });
}
