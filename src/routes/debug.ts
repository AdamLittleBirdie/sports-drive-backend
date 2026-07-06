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
}
