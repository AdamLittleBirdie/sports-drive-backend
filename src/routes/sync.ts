import { FastifyInstance } from 'fastify';
import { syncFitzroyData } from '../services/fitzroy.js';
import { syncWorldCupData } from '../services/worldcup.js';
import { syncBasketballData } from '../services/basketball.js';
import type { ApiResponse } from '../types/index.js';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/sync
   * Manually trigger a data sync for AFL, World Cup, and Basketball.
   * Returns the number of records synced and any errors encountered for each sport.
   */
  app.post<{ Reply: ApiResponse<object> }>('/api/sync', async (_req, reply) => {
    try {
      // Sync AFL
      const aflStats = await syncFitzroyData();

      // Sync World Cup
      const worldCupStats = await syncWorldCupData();

      // Sync Basketball
      const basketballStats = await syncBasketballData();

      return reply.code(200).send({
        statusCode: 200,
        data: {
          afl: aflStats,
          worldCup: worldCupStats,
          basketball: basketballStats,
          message: `AFL: ${aflStats.synced} synced, ${aflStats.errors} errors | World Cup: ${worldCupStats.synced} synced, ${worldCupStats.errors} errors | Basketball: ${basketballStats.teams_synced} teams, ${basketballStats.matches_synced} matches, ${basketballStats.errors} errors`,
        },
      });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Sync failed' });
    }
  });
}

