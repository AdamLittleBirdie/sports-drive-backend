import { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@sports-drive/shared-types';

/**
 * Health-check route — kept as a standalone plugin so it can be
 * imported and tested independently of the main server.
 */
export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async (_req, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  });
}
