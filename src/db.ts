import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

/**
 * Create all tables if they do not already exist.
 * Safe to call on every startup (idempotent).
 */
export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      abbreviation TEXT NOT NULL,
      logo_url    TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id       SERIAL PRIMARY KEY,
      name     TEXT NOT NULL,
      team_id  INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      position TEXT,
      number   INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id           SERIAL PRIMARY KEY,
      round        TEXT NOT NULL,
      home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      date         TIMESTAMPTZ,
      home_score   INTEGER,
      away_score   INTEGER,
      status       TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed'))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS match_stats (
      id         SERIAL PRIMARY KEY,
      match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      disposals  INTEGER,
      marks      INTEGER,
      goals      INTEGER,
      behinds    INTEGER,
      tackles    INTEGER,
      kicks      INTEGER,
      handballs  INTEGER,
      hit_outs   INTEGER,
      UNIQUE (match_id, player_id)
    )
  `;

  console.log('Database schema initialised');
}
