import { FastifyInstance } from 'fastify';
import { sql } from '../db.js';
import type { PlayerWithStats, ApiResponse } from '../types/index.js';

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/players/:id
   * Returns a single player with all their match stats.
   */
  app.get<{ Params: { id: string }; Reply: ApiResponse<PlayerWithStats> }>(
    '/api/players/:id',
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return reply.code(400).send({ statusCode: 400, error: 'Invalid player id' });
      }

      try {
        const [player] = await sql`
          SELECT id, name, team_id, position, number
          FROM players
          WHERE id = ${id}
        `;

        if (!player) {
          return reply.code(404).send({ statusCode: 404, error: 'Player not found' });
        }

        const stats = await sql`
          SELECT *
          FROM match_stats
          WHERE player_id = ${id}
          ORDER BY match_id ASC
        `;

        return reply.code(200).send({ statusCode: 200, data: { ...player, stats } });
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ statusCode: 500, error: 'Failed to fetch player' });
      }
    },
  );
}
