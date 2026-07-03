import { FastifyInstance } from 'fastify';
import { syncFitzroyData } from '../services/fitzroy.js';
import type { SyncResult, ApiResponse } from '@sports-drive/shared-types';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/sync
   * Manually trigger a Fitzroy data sync.
   * Returns the number of records synced and any errors encountered.
   */
  app.post<{ Reply: ApiResponse<SyncResult> }>('/api/sync', async (_req, reply) => {
    try {
      const { synced, errors } = await syncFitzroyData();
      const result: SyncResult = {
        synced,
        errors,
        message: errors === 0
          ? `Successfully synced ${synced} records`
          : `Synced ${synced} records with ${errors} error(s)`,
      };
      return reply.code(200).send({ statusCode: 200, data: result });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ statusCode: 500, error: 'Sync failed' });
    }
  });
}
