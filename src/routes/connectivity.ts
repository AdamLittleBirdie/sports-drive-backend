import { FastifyInstance } from 'fastify';
import axios from 'axios';

const API_SPORTS_KEY = '404f293f746d43be3efd5457c97406d1';

export async function connectivityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/test-connectivity
   * Probes multiple external endpoints to diagnose DNS / network issues.
   * Tests httpbin.org, google.com, and the API-Sports AFL endpoint in turn.
   */
  app.get('/api/test-connectivity', async (_req, reply) => {
    const results: {
      timestamp: string;
      tests: Record<string, unknown>;
    } = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test 1: httpbin.org (simple HTTP endpoint)
    try {
      const response = await axios.get('https://httpbin.org/get', { timeout: 5000 });
      results.tests.httpbin = {
        status: 'success',
        statusCode: response.status,
        message: 'httpbin.org is reachable',
      };
    } catch (err) {
      results.tests.httpbin = {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Test 2: google.com (DNS resolution test)
    try {
      const response = await axios.get('https://google.com', { timeout: 5000 });
      results.tests.google = {
        status: 'success',
        statusCode: response.status,
        message: 'google.com is reachable',
      };
    } catch (err) {
      results.tests.google = {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Test 3: API-Sports AFL endpoint
    try {
      const response = await axios.get('https://v3.afl.api-sports.io/fixtures', {
        headers: {
          'x-apisports-key': API_SPORTS_KEY,
        },
        timeout: 5000,
      });
      results.tests.apiSports = {
        status: 'success',
        statusCode: response.status,
        message: 'API-Sports is reachable',
        fixturesCount: Array.isArray(response.data?.response)
          ? response.data.response.length
          : 0,
      };
    } catch (err) {
      results.tests.apiSports = {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return reply.send(results);
  });
}
