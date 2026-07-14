import postgres from 'postgres';
import cron from 'node-cron';
import { syncFitzroyData, syncAflPlayers, syncLiveFixture } from './services/fitzroy.js';
import { syncWorldCupData } from './services/worldcup.js';

/** Handle for the self-scheduling sync loop, so it can be cleared/rescheduled. */
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Self-scheduling sync loop.
 *
 * During idle periods, runs a full sync every 6 hours. When AFL or World Cup
 * matches are in progress, switches to syncing each live AFL fixture
 * individually every minute (goal scorers + live score, recorded to
 * afl_match_scores for the worm visualization).
 */
async function performSync(): Promise<void> {
  console.log('Sync running...');
  try {
    // Determine if we're in a live window
    const [{ count }] = await sql<[{ count: string }]>`
      SELECT COUNT(*)::text as count
      FROM (
        SELECT id, status FROM afl_matches WHERE status = 'in_progress'
        UNION ALL
        SELECT id, status FROM world_cup_matches WHERE status = 'in_progress'
      ) as live_matches
    `;

    const liveMatchCount = parseInt(count, 10);
    const liveOnly = liveMatchCount > 0;

    if (liveOnly) {
      // During live window, sync individual fixtures + record scores for worm
      console.log('Syncing live fixtures individually...');

      const liveAflMatches = await sql<[{ id: number }]>`
        SELECT id FROM afl_matches WHERE status = 'in_progress'
      `;

      for (const match of liveAflMatches) {
        try {
          await syncLiveFixture(match.id);
        } catch (err) {
          console.error(`Failed to sync fixture ${match.id}:`, err);
        }
      }

      console.log('Live fixture sync complete');
    } else {
      // Normal idle cadence - full sync
      console.log('Running full sync...');
      await syncFitzroyData();
      await syncWorldCupData();
      console.log('Full sync complete');
    }

    // Schedule next sync based on whether matches are live
    const nextSyncMinutes = liveMatchCount > 0 ? 1 : 360;
    console.log(
      `${liveMatchCount} live matches found. Next sync in ${nextSyncMinutes} minutes.`
    );

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void performSync(), nextSyncMinutes * 60 * 1000);
  } catch (err) {
    console.error('Sync error:', err);
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void performSync(), 360 * 60 * 1000);
  }
}

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

  await sql`
    CREATE TABLE IF NOT EXISTS match_events (
      id           SERIAL PRIMARY KEY,
      match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      type         VARCHAR(50),
      event_type   TEXT,
      team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      team         VARCHAR(255),
      player_id    INTEGER,
      player_name  TEXT,
      player       VARCHAR(255),
      assist_id    INTEGER,
      assist_name  TEXT,
      elapsed      INTEGER,
      extra        INTEGER,
      detail       TEXT,
      comments     TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (match_id, type, player, elapsed, extra)
    )
  `;

  // ── Football tables ──────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS football_teams (
      id           SERIAL PRIMARY KEY,
      api_id       INTEGER UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      abbreviation VARCHAR(10),
      logo_url     TEXT,
      country      VARCHAR(100),
      founded      INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS football_matches (
      id             SERIAL PRIMARY KEY,
      api_id         INTEGER UNIQUE NOT NULL,
      league_id      INTEGER NOT NULL,
      league_name    VARCHAR(255),
      season         INTEGER,
      round          VARCHAR(100),
      home_team_id   INTEGER REFERENCES football_teams(id),
      away_team_id   INTEGER REFERENCES football_teams(id),
      home_team_name VARCHAR(255),
      away_team_name VARCHAR(255),
      date           TIMESTAMP,
      home_score     INTEGER,
      away_score     INTEGER,
      status         VARCHAR(50),
      venue          VARCHAR(255),
      referee        VARCHAR(255),
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS football_players (
      id          SERIAL PRIMARY KEY,
      api_id      INTEGER UNIQUE NOT NULL,
      name        VARCHAR(255) NOT NULL,
      position    VARCHAR(50),
      nationality VARCHAR(100),
      birth_date  DATE,
      photo_url   TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS football_match_stats (
      id                 SERIAL PRIMARY KEY,
      match_id           INTEGER REFERENCES football_matches(id),
      team_id            INTEGER REFERENCES football_teams(id),
      shots_on_goal      INTEGER,
      shots_off_goal     INTEGER,
      total_shots        INTEGER,
      blocked_shots      INTEGER,
      fouls              INTEGER,
      corner_kicks       INTEGER,
      offsides           INTEGER,
      ball_possession    DECIMAL(5,2),
      yellow_cards       INTEGER,
      red_cards          INTEGER,
      goalkeeper_saves   INTEGER,
      total_passes       INTEGER,
      passes_accurate    INTEGER,
      passes_percentage  DECIMAL(5,2),
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (match_id, team_id)
    )
  `;

  // ── Basketball tables ─────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS basketball_teams (
      id           SERIAL PRIMARY KEY,
      api_id       INTEGER UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      abbreviation VARCHAR(10),
      logo_url     TEXT,
      country      VARCHAR(100),
      founded      INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS basketball_matches (
      id             SERIAL PRIMARY KEY,
      api_id         INTEGER UNIQUE NOT NULL,
      league_id      INTEGER NOT NULL,
      league_name    VARCHAR(255),
      season         VARCHAR(50),
      round          VARCHAR(100),
      home_team_id   INTEGER REFERENCES basketball_teams(id),
      away_team_id   INTEGER REFERENCES basketball_teams(id),
      home_team_name VARCHAR(255),
      away_team_name VARCHAR(255),
      date           TIMESTAMP,
      home_score     INTEGER,
      away_score     INTEGER,
      status         VARCHAR(50),
      venue          VARCHAR(255),
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS basketball_match_stats (
      id                      SERIAL PRIMARY KEY,
      match_id                INTEGER REFERENCES basketball_matches(id),
      team_id                 INTEGER REFERENCES basketball_teams(id),
      points                  INTEGER,
      field_goals_made        INTEGER,
      field_goals_attempted   INTEGER,
      three_pointers_made     INTEGER,
      three_pointers_attempted INTEGER,
      free_throws_made        INTEGER,
      free_throws_attempted   INTEGER,
      rebounds                INTEGER,
      assists                 INTEGER,
      steals                  INTEGER,
      blocks                  INTEGER,
      turnovers               INTEGER,
      fouls                   INTEGER,
      created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (match_id, team_id)
    )
  `;

  // ── Rugby tables ─────────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS rugby_teams (
      id           SERIAL PRIMARY KEY,
      api_id       INTEGER UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      abbreviation VARCHAR(10),
      logo_url     TEXT,
      country      VARCHAR(100),
      founded      INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rugby_matches (
      id             SERIAL PRIMARY KEY,
      api_id         INTEGER UNIQUE NOT NULL,
      league_id      INTEGER NOT NULL,
      league_name    VARCHAR(255),
      season         INTEGER,
      round          VARCHAR(100),
      home_team_id   INTEGER REFERENCES rugby_teams(id),
      away_team_id   INTEGER REFERENCES rugby_teams(id),
      home_team_name VARCHAR(255),
      away_team_name VARCHAR(255),
      date           TIMESTAMP,
      home_score     INTEGER,
      away_score     INTEGER,
      status         VARCHAR(50),
      venue          VARCHAR(255),
      referee        VARCHAR(255),
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rugby_match_stats (
      id          SERIAL PRIMARY KEY,
      match_id    INTEGER REFERENCES rugby_matches(id),
      team_id     INTEGER REFERENCES rugby_teams(id),
      tries       INTEGER,
      goals       INTEGER,
      field_goals INTEGER,
      tackles     INTEGER,
      offloads    INTEGER,
      passes      INTEGER,
      runs        INTEGER,
      line_breaks INTEGER,
      errors      INTEGER,
      penalties   INTEGER,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (match_id, team_id)
    )
  `;

  // ── AFL tables ───────────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS afl_matches (
      id           SERIAL PRIMARY KEY,
      round        TEXT NOT NULL,
      home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      date         TIMESTAMPTZ,
      home_score   JSONB,
      away_score   JSONB,
      home_winner  BOOLEAN,
      status       TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed'))
    )
  `;

  // Unique index required for the ON CONFLICT upsert in the Fitzroy sync service
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS afl_matches_date_home_away_idx
    ON afl_matches (date, home_team_id, away_team_id)
  `;

  // Migrate AFL data from matches to afl_matches
  try {
    const migratedCount = await sql`
      INSERT INTO afl_matches (id, round, home_team_id, away_team_id, date, home_score, away_score, home_winner, status)
      SELECT id, round, home_team_id, away_team_id, date, home_score, away_score, home_winner, status
      FROM matches
      WHERE round = 'Regular Season'
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('Migrated AFL data from matches to afl_matches');
  } catch (err) {
    console.log('AFL migration skipped or already completed:', err instanceof Error ? err.message : err);
  }

  await sql`
    CREATE TABLE IF NOT EXISTS afl_players (
      id           SERIAL PRIMARY KEY,
      api_id       INTEGER UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS afl_match_events (
      id           SERIAL PRIMARY KEY,
      match_id     INTEGER NOT NULL REFERENCES afl_matches(id) ON DELETE CASCADE,
      player_id    INTEGER REFERENCES afl_players(id) ON DELETE SET NULL,
      event_type   VARCHAR(50) NOT NULL,
      timestamp    INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS afl_match_scores (
      id           SERIAL PRIMARY KEY,
      match_id     INTEGER NOT NULL REFERENCES afl_matches(id) ON DELETE CASCADE,
      timestamp    TIMESTAMP NOT NULL,
      home_score   INTEGER,
      away_score   INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // ── World Cup tables ──────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS world_cup_matches (
      id           SERIAL PRIMARY KEY,
      round        TEXT NOT NULL,
      home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      date         TIMESTAMPTZ,
      home_score   JSONB,
      away_score   JSONB,
      home_winner  BOOLEAN,
      status       TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed'))
    )
  `;

  // Unique index required for the ON CONFLICT upsert in the World Cup sync service
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS world_cup_matches_date_home_away_idx
    ON world_cup_matches (date, home_team_id, away_team_id)
  `;

  // Migrate World Cup data from matches to world_cup_matches
  try {
    const migratedCount = await sql`
      INSERT INTO world_cup_matches (id, round, home_team_id, away_team_id, date, home_score, away_score, home_winner, status)
      SELECT id, round, home_team_id, away_team_id, date, home_score, away_score, home_winner, status
      FROM matches
      WHERE round != 'Regular Season'
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('Migrated World Cup data from matches to world_cup_matches');
  } catch (err) {
    console.log('World Cup migration skipped or already completed:', err instanceof Error ? err.message : err);
  }

  // Kick off the self-scheduling sync loop. It runs an initial full sync and
  // then reschedules itself every 6 hours (or every minute while matches are live).
  void performSync();

  // Initial player roster sync on startup
  void syncAflPlayers(2026);

  // Monthly player sync on the 1st at 01:00 UTC
  cron.schedule('0 1 1 * *', async () => {
    console.log('Monthly AFL player sync running...');
    try {
      await syncAflPlayers(2026);
      console.log('Monthly player sync complete');
    } catch (err) {
      console.error('Monthly player sync error:', err);
    }
  });

  console.log('Database schema initialised');
}
