import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import { syncBasketballData } from '../services/basketball.js';
import type {
  BasketballTeam,
  BasketballMatch,
  BasketballMatchWithTeams,
  BasketballMatchStat,
  BasketballSyncResult,
  ApiResponse,
} from '../types/index.js';

export async function basketballRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/basketball/teams ──────────────────────────────────────────────

  /**
   * Returns all basketball teams ordered alphabetically.
   * Optional query param: ?country=USA
   */
  app.get<{
    Querystring: { country?: string };
    Reply: ApiResponse<BasketballTeam[]>;
  }>('/api/basketball/teams', async (req, reply) => {
    try {
      const { country } = req.query;

      const rows = country
        ? await sql<BasketballTeam[]>`
            SELECT id, api_id, name, abbreviation, logo_url, country, founded, created_at, updated_at
            FROM basketball_teams
            WHERE country ILIKE ${country}
            ORDER BY name ASC
          `
        : await sql<BasketballTeam[]>`
            SELECT id, api_id, name, abbreviation, logo_url, country, founded, created_at, updated_at
            FROM basketball_teams
            ORDER BY name ASC
          `;

      return reply.code(200).send({ statusCode: 200, data: rows });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch basketball teams' });
    }
  });

  // ── GET /api/basketball/matches ────────────────────────────────────────────

  /**
   * Returns all basketball matches with home/away team objects joined in.
   *
   * Optional query params:
   *   ?league=12          filter by league_id
   *   ?season=2024-2025   filter by season
   *   ?team=<db_id>       filter matches where team is home or away
   *   ?status=completed   filter by status
   */
  app.get<{
    Querystring: {
      league?: string;
      season?: string;
      team?: string;
      status?: string;
    };
    Reply: ApiResponse<BasketballMatchWithTeams[]>;
  }>('/api/basketball/matches', async (req, reply) => {
    try {
      const { league, season, team, status } = req.query;

      const leagueId = league ? parseInt(league, 10) : null;
      const teamId = team ? parseInt(team, 10) : null;

      if (
        (league && isNaN(leagueId!)) ||
        (team && isNaN(teamId!))
      ) {
        return reply.code(400).send({ statusCode: 400, error: 'Invalid query parameter' });
      }

      const rows = await sql<BasketballMatchWithTeams[]>`
        SELECT
          m.id,
          m.api_id,
          m.league_id,
          m.league_name,
          m.season,
          m.round,
          m.home_team_id,
          m.away_team_id,
          m.home_team_name,
          m.away_team_name,
          m.date,
          m.home_score,
          m.away_score,
          m.status,
          m.venue,
          m.created_at,
          m.updated_at,
          row_to_json(ht.*) AS home_team,
          row_to_json(at.*) AS away_team
        FROM basketball_matches m
        LEFT JOIN basketball_teams ht ON ht.id = m.home_team_id
        LEFT JOIN basketball_teams at ON at.id = m.away_team_id
        WHERE
          (${leagueId}::integer IS NULL OR m.league_id = ${leagueId})
          AND (${season ?? null}::text IS NULL OR m.season = ${season ?? null})
          AND (${teamId}::integer IS NULL OR m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
          AND (${status ?? null}::text IS NULL OR m.status = ${status ?? null})
        ORDER BY m.date ASC NULLS LAST, m.id ASC
      `;

      return reply.code(200).send({ statusCode: 200, data: rows });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch basketball matches' });
    }
  });

  // ── GET /api/basketball/matches/:id ───────────────────────────────────────

  /**
   * Returns a single basketball match with full team objects and match statistics.
   */
  app.get<{
    Params: { id: string };
    Reply: ApiResponse<BasketballMatchWithTeams>;
  }>('/api/basketball/matches/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ statusCode: 400, error: 'Invalid match id' });
    }

    try {
      const [match] = await sql<BasketballMatchWithTeams[]>`
        SELECT
          m.id,
          m.api_id,
          m.league_id,
          m.league_name,
          m.season,
          m.round,
          m.home_team_id,
          m.away_team_id,
          m.home_team_name,
          m.away_team_name,
          m.date,
          m.home_score,
          m.away_score,
          m.status,
          m.venue,
          m.created_at,
          m.updated_at,
          row_to_json(ht.*) AS home_team,
          row_to_json(at.*) AS away_team
        FROM basketball_matches m
        LEFT JOIN basketball_teams ht ON ht.id = m.home_team_id
        LEFT JOIN basketball_teams at ON at.id = m.away_team_id
        WHERE m.id = ${id}
      `;

      if (!match) {
        return reply.code(404).send({ statusCode: 404, error: 'Match not found' });
      }

      const stats = await sql<BasketballMatchStat[]>`
        SELECT * FROM basketball_match_stats WHERE match_id = ${id}
      `;

      return reply.code(200).send({ statusCode: 200, data: { ...match, stats } });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch basketball match' });
    }
  });

  // ── POST /api/basketball/sync ──────────────────────────────────────────────

  /**
   * Trigger a full sync of basketball data from API-Sports Basketball.
   * Syncs teams, games, and statistics for all configured leagues.
   */
  app.post<{ Reply: ApiResponse<BasketballSyncResult> }>('/api/basketball/sync', async (_req, reply) => {
    try {
      const result = await syncBasketballData();
      return reply.code(200).send({ statusCode: 200, data: result });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Basketball sync failed' });
    }
  });
}
