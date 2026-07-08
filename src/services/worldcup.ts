/**
 * World Cup sync service
 *
 * Fetches team, fixture, and statistics data from v3.football.api-sports.io
 * scoped exclusively to the FIFA World Cup 2026 (league_id: 1, season: 2026).
 *
 * Data is upserted into the football_* tables (shared with the general football
 * service) so the function is safe to call repeatedly without creating
 * duplicates.
 *
 * Strategy:
 *  1. Fetch the full tournament fixture list (no date filter) so the complete
 *     schedule is always present in the DB.
 *  2. For fixtures that have already kicked off, fetch fresh individual fixture
 *     details to get the latest scores and status.
 *  3. Fetch and upsert per-team statistics for completed fixtures.
 */

import {
  fetchFootballTeams,
  fetchFootballFixtures,
  fetchFootballFixtureById,
  fetchMatchStatistics,
  transformFootballMatch,
} from './football.js';
import { sql } from '../db.js';
import type { WorldCupSyncResult } from '../types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

// ── Database helpers ──────────────────────────────────────────────────────────

/**
 * Upsert a football team (reuses the football_teams table) and return its
 * internal DB id.
 */
async function upsertTeam(team: {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
  country: string | null;
  founded: number | null;
}): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO football_teams (api_id, name, abbreviation, logo_url, country, founded, updated_at)
    VALUES (
      ${team.id},
      ${team.name},
      ${team.code ?? null},
      ${team.logo ?? null},
      ${team.country ?? null},
      ${team.founded ?? null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (api_id) DO UPDATE SET
      name         = EXCLUDED.name,
      abbreviation = EXCLUDED.abbreviation,
      logo_url     = EXCLUDED.logo_url,
      country      = EXCLUDED.country,
      founded      = EXCLUDED.founded,
      updated_at   = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return rows[0].id;
}

/**
 * Upsert a football match row and return its internal DB id.
 */
async function upsertMatch(
  transformed: ReturnType<typeof transformFootballMatch>,
  homeDbId: number | null,
  awayDbId: number | null,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO football_matches (
      api_id, league_id, league_name, season, round,
      home_team_id, away_team_id, home_team_name, away_team_name,
      date, home_score, away_score, status, venue, referee,
      updated_at
    )
    VALUES (
      ${transformed.api_id},
      ${transformed.league_id},
      ${transformed.league_name},
      ${transformed.season},
      ${transformed.round},
      ${homeDbId},
      ${awayDbId},
      ${transformed.home_team_name},
      ${transformed.away_team_name},
      ${transformed.date},
      ${transformed.home_score},
      ${transformed.away_score},
      ${transformed.status},
      ${transformed.venue},
      ${transformed.referee},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (api_id) DO UPDATE SET
      league_name    = EXCLUDED.league_name,
      season         = EXCLUDED.season,
      round          = EXCLUDED.round,
      home_team_id   = EXCLUDED.home_team_id,
      away_team_id   = EXCLUDED.away_team_id,
      home_team_name = EXCLUDED.home_team_name,
      away_team_name = EXCLUDED.away_team_name,
      date           = EXCLUDED.date,
      home_score     = EXCLUDED.home_score,
      away_score     = EXCLUDED.away_score,
      status         = EXCLUDED.status,
      venue          = EXCLUDED.venue,
      referee        = EXCLUDED.referee,
      updated_at     = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return rows[0].id;
}

// ── Public sync function ──────────────────────────────────────────────────────

/**
 * Sync all World Cup 2026 data (teams, fixtures, stats) into the football_*
 * tables.  Returns a summary of what was synced and any errors encountered.
 */
export async function syncWorldCupData(): Promise<WorldCupSyncResult> {
  let teamsSynced = 0;
  let matchesSynced = 0;
  let statsSynced = 0;
  let errors = 0;

  console.log(`World Cup sync starting (league=${WORLD_CUP_LEAGUE_ID}, season=${WORLD_CUP_SEASON})…`);

  // ── 1. Teams ───────────────────────────────────────────────────────────────

  const teamsData = await fetchFootballTeams(WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON);
  /** Map from API team id → internal DB id, built as we upsert. */
  const teamIdMap = new Map<number, number>();

  if (teamsData) {
    for (const entry of teamsData) {
      try {
        const dbId = await upsertTeam(entry.team);
        teamIdMap.set(entry.team.id, dbId);
        teamsSynced++;
      } catch (err) {
        console.error(
          `World Cup sync: error upserting team ${entry.team.name}:`,
          err instanceof Error ? err.message : err,
        );
        errors++;
      }
    }
  } else {
    console.warn('World Cup sync: no team data returned — skipping team upsert');
  }

  // ── 2. Fixtures ────────────────────────────────────────────────────────────
  //
  // Fetch the full tournament schedule (no date filter) so every fixture is
  // present in the DB.  For fixtures that have already kicked off, fetch fresh
  // individual details to get up-to-date scores and status.

  const fixturesData = await fetchFootballFixtures(WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON);

  if (!fixturesData) {
    console.warn('World Cup sync: no fixture data returned — skipping fixture upsert');
    const message = `World Cup sync incomplete — no fixture data (teams: ${teamsSynced}, errors: ${errors})`;
    return {
      teams_synced: teamsSynced,
      matches_synced: matchesSynced,
      stats_synced: statsSynced,
      synced: matchesSynced,
      errors,
      message,
    };
  }

  console.log(`World Cup sync: fetched ${fixturesData.length} fixtures from API`);

  for (const rawFixture of fixturesData) {
    try {
      // For fixtures that have already begun, fetch fresh individual details
      // so scores and status are current.
      let fixture = rawFixture;
      const statusShort = rawFixture.fixture.status.short;
      const hasBegun = statusShort !== 'NS' && statusShort !== 'TBD';

      if (hasBegun) {
        const fresh = await fetchFootballFixtureById(rawFixture.fixture.id);
        if (fresh) {
          fixture = fresh;
        } else {
          console.warn(
            `World Cup sync: fetchFootballFixtureById returned null for fixture ${rawFixture.fixture.id} — using schedule data`,
          );
        }
      }

      const transformed = transformFootballMatch(fixture);

      // Resolve team api_ids to internal DB ids
      let homeDbId = teamIdMap.get(fixture.teams.home.id) ?? null;
      let awayDbId = teamIdMap.get(fixture.teams.away.id) ?? null;

      if (homeDbId === null) {
        const rows = await sql<{ id: number }[]>`
          SELECT id FROM football_teams WHERE api_id = ${fixture.teams.home.id}
        `;
        homeDbId = rows[0]?.id ?? null;
      }
      if (awayDbId === null) {
        const rows = await sql<{ id: number }[]>`
          SELECT id FROM football_teams WHERE api_id = ${fixture.teams.away.id}
        `;
        awayDbId = rows[0]?.id ?? null;
      }

      const matchDbId = await upsertMatch(transformed, homeDbId, awayDbId);
      matchesSynced++;

      // ── 3. Statistics (completed matches only) ───────────────────────────

      if (transformed.status === 'completed') {
        const statsData = await fetchMatchStatistics(fixture.fixture.id);
        if (statsData) {
          for (const teamStats of statsData) {
            const teamDbId =
              teamIdMap.get(teamStats.team.id) ??
              (
                await sql<{ id: number }[]>`
                  SELECT id FROM football_teams WHERE api_id = ${teamStats.team.id}
                `
              )[0]?.id ??
              null;

            if (teamDbId === null) {
              console.warn(
                `World Cup sync: unknown team api_id ${teamStats.team.id} for fixture ${fixture.fixture.id}`,
              );
              continue;
            }

            try {
              await sql`
                INSERT INTO football_match_stats (
                  match_id, team_id,
                  shots_on_goal, shots_off_goal, total_shots, blocked_shots,
                  fouls, corner_kicks, offsides, ball_possession,
                  yellow_cards, red_cards, goalkeeper_saves,
                  total_passes, passes_accurate, passes_percentage,
                  updated_at
                )
                VALUES (
                  ${matchDbId}, ${teamDbId},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Shots on Goal')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Shots off Goal')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Total Shots')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Blocked Shots')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Fouls')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Corner Kicks')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Offsides')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Ball Possession')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Yellow Cards')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Red Cards')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Goalkeeper Saves')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Total passes')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Passes accurate')?.value ?? null},
                  ${statsData[0]?.statistics?.find(s => s.type === 'Passes %')?.value ?? null},
                  CURRENT_TIMESTAMP
                )
                ON CONFLICT (match_id, team_id) DO UPDATE SET
                  shots_on_goal     = EXCLUDED.shots_on_goal,
                  shots_off_goal    = EXCLUDED.shots_off_goal,
                  total_shots       = EXCLUDED.total_shots,
                  blocked_shots     = EXCLUDED.blocked_shots,
                  fouls             = EXCLUDED.fouls,
                  corner_kicks      = EXCLUDED.corner_kicks,
                  offsides          = EXCLUDED.offsides,
                  ball_possession   = EXCLUDED.ball_possession,
                  yellow_cards      = EXCLUDED.yellow_cards,
                  red_cards         = EXCLUDED.red_cards,
                  goalkeeper_saves  = EXCLUDED.goalkeeper_saves,
                  total_passes      = EXCLUDED.total_passes,
                  passes_accurate   = EXCLUDED.passes_accurate,
                  passes_percentage = EXCLUDED.passes_percentage,
                  updated_at        = CURRENT_TIMESTAMP
              `;
              statsSynced++;
            } catch (err) {
              console.error(
                `World Cup sync: error upserting stats for fixture ${fixture.fixture.id}:`,
                err instanceof Error ? err.message : err,
              );
              errors++;
            }
          }
        }
      }
    } catch (err) {
      console.error(
        `World Cup sync: error syncing fixture ${rawFixture.fixture.id}:`,
        err instanceof Error ? err.message : err,
      );
      errors++;
    }
  }

  const message =
    errors === 0
      ? `Successfully synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records`
      : `Synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records with ${errors} error(s)`;

  console.log(`World Cup sync complete — ${message}`);

  return {
    teams_synced: teamsSynced,
    matches_synced: matchesSynced,
    stats_synced: statsSynced,
    synced: matchesSynced,
    errors,
    message,
  };
}
