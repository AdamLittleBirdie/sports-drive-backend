import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import type { ApiResponse } from '../types/index.js';

interface SportDateInfo {
  min_date: string | null;
  max_date: string | null;
  total_count: number;
  last_30_days_count: number;
}

interface MatchDatesResponse {
  basketball: SportDateInfo;
  football: SportDateInfo;
  queried_at: string;
}

export async function debugRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/debug/match-dates ─────────────────────────────────────────────

  /**
   * Returns date range info and recent match counts for basketball and football.
   * Useful for verifying whether synced data is from the current season or
   * older seasons returned by the free tier API.
   */
  app.get<{ Reply: ApiResponse<MatchDatesResponse> }>(
    '/api/debug/match-dates',
    async (_req, reply) => {
      try {
        const [basketballDates] = await sql<
          [{ min_date: string | null; max_date: string | null; total_count: string }]
        >`
          SELECT
            MIN(date)::text  AS min_date,
            MAX(date)::text  AS max_date,
            COUNT(*)::text   AS total_count
          FROM basketball_matches
        `;

        const [basketballRecent] = await sql<[{ recent_count: string }]>`
          SELECT COUNT(*)::text AS recent_count
          FROM basketball_matches
          WHERE date >= NOW() - INTERVAL '30 days'
        `;

        const [footballDates] = await sql<
          [{ min_date: string | null; max_date: string | null; total_count: string }]
        >`
          SELECT
            MIN(date)::text  AS min_date,
            MAX(date)::text  AS max_date,
            COUNT(*)::text   AS total_count
          FROM football_matches
        `;

        const [footballRecent] = await sql<[{ recent_count: string }]>`
          SELECT COUNT(*)::text AS recent_count
          FROM football_matches
          WHERE date >= NOW() - INTERVAL '30 days'
        `;

        const data: MatchDatesResponse = {
          basketball: {
            min_date: basketballDates.min_date,
            max_date: basketballDates.max_date,
            total_count: parseInt(basketballDates.total_count, 10),
            last_30_days_count: parseInt(basketballRecent.recent_count, 10),
          },
          football: {
            min_date: footballDates.min_date,
            max_date: footballDates.max_date,
            total_count: parseInt(footballDates.total_count, 10),
            last_30_days_count: parseInt(footballRecent.recent_count, 10),
          },
          queried_at: new Date().toISOString(),
        };

        return reply.code(200).send({ statusCode: 200, data });
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send({ statusCode: 500, error: 'Failed to fetch match date info' });
      }
    },
  );

  // ── GET /api/debug/recent-matches ──────────────────────────────────────────

  /**
   * Returns the most recent completed match for each sport.
   * Useful for debugging data sync issues.
   */
  app.get<{ Reply: ApiResponse<any> }>('/api/debug/recent-matches', async (_req, reply) => {
    try {
      // Most recent completed AFL match
      const [aflMatch] = await sql`
        SELECT 
          'AFL' as sport,
          m.id, m.round, m.date, m.status,
          ht.name as home_team, at.name as away_team,
          m.home_score, m.away_score
        FROM afl_matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        WHERE m.status = 'completed'
        ORDER BY m.date DESC
        LIMIT 1
      `;

      // Most recent completed World Cup match
      const [worldCupMatch] = await sql`
        SELECT 
          'World Cup' as sport,
          m.id, m.round, m.date, m.status,
          ht.name as home_team, at.name as away_team,
          m.home_score, m.away_score
        FROM world_cup_matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        WHERE m.status = 'completed'
        ORDER BY m.date DESC
        LIMIT 1
      `;

      // Most recent completed NBA match
      const [nbaMatch] = await sql`
        SELECT 
          'NBA' as sport,
          bm.id, bm.round, bm.date, bm.status,
          bt.name as home_team, at.name as away_team,
          bm.home_score, bm.away_score
        FROM basketball_matches bm
        LEFT JOIN basketball_teams bt ON bt.id = bm.home_team_id
        LEFT JOIN basketball_teams at ON at.id = bm.away_team_id
        WHERE bm.status = 'completed'
        ORDER BY bm.date DESC
        LIMIT 1
      `;

      const data = {
        afl: aflMatch || null,
        world_cup: worldCupMatch || null,
        nba: nbaMatch || null,
        queried_at: new Date().toISOString(),
      };

      return reply.code(200).send({ statusCode: 200, data });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch recent matches' });
    }
  });

  // ── GET /api/debug/table-counts ────────────────────────────────────────────

  /**
   * Returns the raw row counts for all match tables.
   * Useful for identifying duplicate data or unexpected row inflation
   * (e.g. /api/all-matches returning more results than expected).
   */
  app.get<{ Reply: ApiResponse<any> }>('/api/debug/table-counts', async (_req, reply) => {
    try {
      const [aflCount] = await sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM afl_matches
      `;

      const [worldCupCount] = await sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM world_cup_matches
      `;

      const [footballCount] = await sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM football_matches
      `;

      const [basketballCount] = await sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM basketball_matches
      `;

      const [matchesCount] = await sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM matches
      `;

      const data = {
        afl_matches: parseInt(aflCount.count, 10),
        world_cup_matches: parseInt(worldCupCount.count, 10),
        football_matches: parseInt(footballCount.count, 10),
        basketball_matches: parseInt(basketballCount.count, 10),
        matches: parseInt(matchesCount.count, 10),
        total_all_matches: parseInt(aflCount.count, 10) + parseInt(worldCupCount.count, 10),
        queried_at: new Date().toISOString(),
      };

      return reply.code(200).send({ statusCode: 200, data });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch table counts' });
    }
  });
}
