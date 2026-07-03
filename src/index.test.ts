import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { HealthResponse } from '@sports-drive/shared-types';

describe('Health Endpoint', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.get<{ Reply: HealthResponse }>('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      };
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBe('0.1.0');
  });
});
