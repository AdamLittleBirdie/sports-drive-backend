import Fastify from 'fastify';
import cors from '@fastify/cors';
import { HealthResponse } from '@sports-drive/shared-types';
import { initDb } from './db.js';
import { matchRoutes } from './routes/matches.js';
import { teamRoutes } from './routes/teams.js';
import { playerRoutes } from './routes/players.js';
import { syncRoutes } from './routes/sync.js';

const app = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

// ── Plugins ───────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get<{ Reply: HealthResponse }>('/health', async (_request, _reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  };
});

// ── API routes ────────────────────────────────────────────────────────────────

await app.register(matchRoutes);
await app.register(teamRoutes);
await app.register(playerRoutes);
await app.register(syncRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    // Initialise DB schema before accepting traffic
    await initDb();

    const port = parseInt(process.env.PORT ?? '5000', 10);
    const host = process.env.HOST ?? '0.0.0.0';
    await app.listen({ port, host });
    console.log(`Backend running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
