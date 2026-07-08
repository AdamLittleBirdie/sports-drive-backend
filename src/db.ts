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
      home_score   JSONB,
      away_score   JSONB,
      home_winner  BOOLEAN,
      status       TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed'))
    )
  `;

  // Alter existing matches table to support JSON scores (for AFL)
  try {
    await sql`
      ALTER TABLE matches
      ALTER COLUMN home_score TYPE JSONB USING home_score::text::jsonb,
      ALTER COLUMN away_score TYPE JSONB USING away_score::text::jsonb
    `;
    console.log('Converted matches.home_score and matches.away_score to JSONB');
  } catch (err) {
    // If columns are already JSONB or table doesn't exist, this is fine
    console.log('Matches table already has JSONB scores or does not exist yet');
  }

  try {
    await sql`
      ALTER TABLE matches
      ADD COLUMN home_winner BOOLEAN
    `;
    console.log('Added home_winner column to matches table');
  } catch (err) {
    console.log('home_winner column already exists or table does not exist');
  }

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

  console.log('Database schema initialised');
}
