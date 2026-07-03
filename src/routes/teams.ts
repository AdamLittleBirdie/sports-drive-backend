import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import type { Team, TeamWithPlayers, ApiResponse } from '@sports-drive/shared-types';

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/teams
   * Returns all teams ordered alphabetically.
   */
  app.get<{ Reply: ApiResponse<Team[]> }>('/api/teams', async (_req, reply) => {
    try {
      const rows = await sql<Team[]>`
        SELECT id, name, abbreviation, logo_url
        FROM teams
        ORDER BY name ASC
      `;
      return reply.code(200).send({ statusCode: 200, data: rows });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch teams' });
    }
  });

  /**
   * GET /api/teams/:id
   * Returns a single team with its full player roster.
   */
  app.get<{ Params: { id: string }; Reply: ApiResponse<TeamWithPlayers> }>(
    '/api/teams/:id',
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return reply.code(400).send({ statusCode: 400, error: 'Invalid team id' });
      }

      try {
        const [team] = await sql<Team[]>`
          SELECT id, name, abbreviation, logo_url
          FROM teams
          WHERE id = ${id}
        `;

        if (!team) {
          return reply.code(404).send({ statusCode: 404, error: 'Team not found' });
        }

        const players = await sql`
          SELECT id, name, team_id, position, number
          FROM players
          WHERE team_id = ${id}
          ORDER BY name ASC
        `;

        return reply.code(200).send({ statusCode: 200, data: { ...team, players } });
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch team' });
      }
    },
  );
}
