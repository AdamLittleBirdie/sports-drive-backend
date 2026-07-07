/**
 * API-Football integration
 *
 * Fetches fixture, team, and statistics data from v3.football.api-sports.io
 * for the following competitions:
 *   - Premier League  (league_id: 39, season: 2025)
 *   - La Liga         (league_id: 61, season: 2024)
 *   - Champions League(league_id:  2, season: 2024)
 *   - World Cup 2026  (league_id:  1, season: 2026)
 *
 * All data is upserted into the football_* tables so the function is safe
 * to call repeatedly without creating duplicates.
 */

import axios from 'axios';
import { sql } from '../db.js';
import type { FootballSyncResult } from '../types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FOOTBALL_API_BASE_URL = 'https://v3.football.api-sports.io';
const FOOTBALL_API_KEY = '404f293f746d43be3efd5457c97406d1';

/** Leagues and seasons to sync. */
const LEAGUES: Array<{ leagueId: number; season: number; name: string }> = [
  { leagueId: 39, season: 2025, name: 'Premier League' },
  { leagueId: 61, season: 2024, name: 'La Liga' },
  { leagueId: 2,  season: 2024, name: 'Champions League' },
  { leagueId: 1,  season: 2026, name: 'World Cup 2026' },
];

// ── Raw API response types ────────────────────────────────────────────────────

interface ApiTeamResponse {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    founded: number | null;
    logo: string | null;
  };
  venue?: {
    name: string | null;
  };
}

interface ApiTeamsEnvelope {
  response: ApiTeamResponse[];
}

interface ApiFixture {
  fixture: {
    id: number;
    date: string | null;
    status: { short: string };
    venue: { name: string | null } | null;
    referee: string | null;
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface ApiFixturesEnvelope {
  response: ApiFixture[];
}

interface ApiStatEntry {
  type: string;
  value: string | number | null;
}

interface ApiTeamStats {
  team: { id: number; name: string };
  statistics: ApiStatEntry[];
}

interface ApiStatsEnvelope {
  response: ApiTeamStats[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared axios instance with auth header pre-configured. */
const footballApi = axios.create({
  baseURL: FOOTBALL_API_BASE_URL,
  headers: { 'x-apisports-key': FOOTBALL_API_KEY },
  timeout: 15000,
});

/**
 * Map an API-Football status short code to a human-readable status string.
 */
function mapStatus(short: string): string {
  switch (short) {
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'completed';
    case 'LIVE':
    case '1H':
    case '2H':
    case 'HT':
    case 'ET':
    case 'BT':
    case 'P':
      return 'in_progress';
    default:
      return 'scheduled'; // NS, TBD, PST, CANC, ABD, etc.
  }
}

/**
 * Parse a raw stat value from the API into a number (or null).
 * The API returns values like "55%", "12", null, or "".
 */
function parseStat(value: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace('%', '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/**
 * Find a stat value by type name from an array of stat entries.
 */
function getStat(stats: ApiStatEntry[], type: string): number | null {
  const entry = stats.find(s => s.type === type);
  return entry ? parseStat(entry.value) : null;
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * Fetch all teams for a given league and season from API-Football.
 * Returns the raw response array, or null on failure.
 */
export async function fetchFootballTeams(
  leagueId: number,
  season: number,
): Promise<ApiTeamResponse[] | null> {
  try {
    const res = await footballApi.get<ApiTeamsEnvelope>('/teams', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchFootballTeams: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchFootballTeams failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch fixtures for a given league and season from API-Football,
 * optionally filtered to a date range via the `from` parameter.
 * Returns the raw response array, or null on failure.
 */
export async function fetchFootballMatches(
  leagueId: number,
  season: number,
  fromDate?: string,
): Promise<ApiFixture[] | null> {
  try {
    const params: Record<string, string | number> = { league: leagueId, season };
    if (fromDate) params.from = fromDate;
    const res = await footballApi.get<ApiFixturesEnvelope>('/fixtures', { params });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchFootballMatches: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchFootballMatches failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch all fixtures for a given league and season from API-Football,
 * without any date filtering. Intended for tournaments like the World Cup
 * where the full fixture list is needed upfront.
 * Returns the raw response array, or null on failure.
 */
export async function fetchFootballFixtures(
  leagueId: number,
  season: number,
): Promise<ApiFixture[] | null> {
  try {
    const res = await footballApi.get<ApiFixturesEnvelope>('/fixtures', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchFootballFixtures: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchFootballFixtures failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch detailed data for a single fixture by its API-Football fixture ID.
 * Used to retrieve up-to-date scores and status for in-progress or completed
 * fixtures without fetching the entire league schedule again.
 * Returns the fixture object, or null on failure.
 */
export async function fetchFootballFixtureById(
  fixtureId: number,
): Promise<ApiFixture | null> {
  try {
    const res = await footballApi.get<ApiFixturesEnvelope>('/fixtures', {
      params: { id: fixtureId },
    });
    const data = res.data?.response;
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`fetchFootballFixtureById: no data for fixture ${fixtureId}`);
      return null;
    }
    return data[0];
  } catch (err) {
    console.error(
      `fetchFootballFixtureById failed (fixture=${fixtureId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch statistics for a single fixture from API-Football.
 * Returns the raw response array, or null on failure.
 */
export async function fetchMatchStatistics(
  fixtureId: number,
): Promise<ApiTeamStats[] | null> {
  try {
    const res = await footballApi.get<ApiStatsEnvelope>('/fixtures/statistics', {
      params: { fixture: fixtureId },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) return null;
    return data;
  } catch (err) {
    console.error(
      `fetchMatchStatistics failed (fixture=${fixtureId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Transform a raw API-Football fixture into the shape expected by the
 * football_matches table.  Returns a plain object — no DB calls.
 */
export function transformFootballMatch(apiMatch: ApiFixture) {
  return {
    api_id: apiMatch.fixture.id,
    league_id: apiMatch.league.id,
    league_name: apiMatch.league.name ?? null,
    season: apiMatch.league.season ?? null,
    round: apiMatch.league.round ?? null,
    home_team_api_id: apiMatch.teams.home.id,
    away_team_api_id: apiMatch.teams.away.id,
    home_team_name: apiMatch.teams.home.name,
    away_team_name: apiMatch.teams.away.name,
    date: apiMatch.fixture.date ? new Date(apiMatch.fixture.date) : null,
    home_score: apiMatch.goals.home ?? null,
    away_score: apiMatch.goals.away ?? null,
    status: mapStatus(apiMatch.fixture.status.short),
    venue: apiMatch.fixture.venue?.name ?? null,
    referee: apiMatch.fixture.referee ?? null,
  };
}

// ── Database helpers ──────────────────────────────────────────────────────────

/**
 * Upsert a football team and return its internal DB id.
 */
async function upsertFootballTeam(team: ApiTeamResponse['team']): Promise<number> {
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
 * Upsert a football match row.  Requires the internal DB ids for both teams.
 * Returns the internal DB id of the upserted match.
 */
async function upsertFootballMatch(
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

/**
 * Upsert match statistics for one team in one match.
 */
async function upsertMatchStats(
  matchDbId: number,
  teamDbId: number,
  stats: ApiStatEntry[],
): Promise<void> {
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
      ${getStat(stats, 'Shots on Goal')},
      ${getStat(stats, 'Shots off Goal')},
      ${getStat(stats, 'Total Shots')},
      ${getStat(stats, 'Blocked Shots')},
      ${getStat(stats, 'Fouls')},
      ${getStat(stats, 'Corner Kicks')},
      ${getStat(stats, 'Offsides')},
      ${getStat(stats, 'Ball Possession')},
      ${getStat(stats, 'Yellow Cards')},
      ${getStat(stats, 'Red Cards')},
      ${getStat(stats, 'Goalkeeper Saves')},
      ${getStat(stats, 'Total passes')},
      ${getStat(stats, 'Passes accurate')},
      ${getStat(stats, 'Passes %')},
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
}

// ── Main sync orchestrator ────────────────────────────────────────────────────

/**
 * Sync all football data (teams, matches, stats) for every configured league.
 *
 * Strategy (standard leagues):
 *  1. Delete matches older than 60 days to keep the database lean.
 *  2. For each league, fetch and upsert teams first so FK references exist.
 *  3. Fetch fixtures from the last 60 days only (via the API `from` param),
 *     resolving team api_id → internal DB id.
 *  4. For completed matches only, fetch and upsert per-team statistics.
 *     (Stats are only available once a match has finished.)
 *
 * Strategy (World Cup 2026 — leagueId 1, season 2026):
 *  1. Fetch the full fixture list for the tournament via fetchFootballFixtures
 *     (no date filter) and upsert every fixture so the schedule is always complete.
 *  2. For fixtures that have already begun (status !== "NS" / "TBD"), fetch
 *     fresh individual fixture details via fetchFootballFixtureById to get the
 *     latest scores and status without re-downloading the entire schedule.
 *  3. Fetch and upsert per-team statistics for completed fixtures.
 *
 * This two-step approach for the World Cup avoids the rate-limit issues caused
 * by repeatedly hitting the games endpoint for every fixture.
 */
export async function syncFootballData(): Promise<FootballSyncResult> {
  let teamsSynced = 0;
  let matchesSynced = 0;
  let statsSynced = 0;
  let errors = 0;

  // Compute the cutoff date (60 days ago) once for the whole sync run
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 60);
  const fromDateStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"
  console.log(`Football sync cutoff: ${cutoff.toISOString()}`);

  // Remove matches older than 60 days before syncing to keep the DB lean.
  // World Cup fixtures are exempt — they are pruned separately below.
  try {
    // Delete stats first to avoid foreign key constraint
    await sql`DELETE FROM football_match_stats WHERE match_id IN (
      SELECT id FROM football_matches WHERE date < NOW() - INTERVAL '60 days' AND league_id != 1
    )`;
    // Then delete matches
    await sql`DELETE FROM football_matches WHERE date < NOW() - INTERVAL '60 days' AND league_id != 1`;
    console.log('Football sync: pruned non-World-Cup matches older than 60 days');
  } catch (err) {
    console.error('Football sync: failed to prune old matches:', err instanceof Error ? err.message : err);
  }

  for (const league of LEAGUES) {
    const isWorldCup = league.leagueId === 1 && league.season === 2026;

    if (isWorldCup) {
      console.log(`Syncing ${league.name} (league=${league.leagueId}, season=${league.season}) — using fixtures endpoint…`);
    } else {
      console.log(`Syncing ${league.name} (league=${league.leagueId}, season=${league.season}, from=${fromDateStr})…`);
    }

    // ── 1. Teams ────────────────────────────────────────────────────────────

    const teamsData = await fetchFootballTeams(league.leagueId, league.season);
    /** Map from API team id → internal DB id, built as we upsert. */
    const teamIdMap = new Map<number, number>();

    if (teamsData) {
      for (const entry of teamsData) {
        try {
          const dbId = await upsertFootballTeam(entry.team);
          teamIdMap.set(entry.team.id, dbId);
          teamsSynced++;
        } catch (err) {
          console.error(`Error upserting team ${entry.team.name}:`, err instanceof Error ? err.message : err);
          errors++;
        }
      }
    } else {
      console.warn(`No team data for ${league.name} — skipping team upsert`);
    }

    // ── 2. Fixtures ──────────────────────────────────────────────────────────
    //
    // World Cup: fetch the full tournament schedule (no date filter), then
    // refresh individual fixtures that have already kicked off.
    //
    // Other leagues: fetch only the last 60 days to limit API usage.

    let fixturesData: ApiFixture[] | null;

    if (isWorldCup) {
      // Step 2a — fetch the complete World Cup schedule
      fixturesData = await fetchFootballFixtures(league.leagueId, league.season);
    } else {
      fixturesData = await fetchFootballMatches(league.leagueId, league.season, fromDateStr);
    }

    if (!fixturesData) {
      console.warn(`No fixture data for ${league.name} — skipping`);
      continue;
    }

    console.log(`Fetched ${fixturesData.length} fixtures from API for ${league.name}`);

    for (const rawFixture of fixturesData) {
      try {
        // Step 2b (World Cup only) — for fixtures that have begun, fetch fresh
        // individual fixture details so scores and status are up to date.
        let fixture = rawFixture;
        if (isWorldCup) {
          const statusShort = rawFixture.fixture.status.short;
          const hasBegun = statusShort !== 'NS' && statusShort !== 'TBD';
          if (hasBegun) {
            const fresh = await fetchFootballFixtureById(rawFixture.fixture.id);
            if (fresh) {
              fixture = fresh;
            } else {
              console.warn(`fetchFootballFixtureById returned null for fixture ${rawFixture.fixture.id} — using schedule data`);
            }
          }
        }

        console.log(`Fixture ${fixture.fixture.id}: date=${fixture.fixture.date}, status=${fixture.fixture.status.short}`);
        const transformed = transformFootballMatch(fixture);
        console.log(`Transformed fixture ${transformed.api_id}: date=${transformed.date?.toISOString() ?? 'null'}, cutoff=${cutoff.toISOString()}, include=${transformed.date === null || transformed.date >= cutoff}`);

        // Resolve team api_ids to internal DB ids (may be null if team wasn't fetched)
        let homeDbId = teamIdMap.get(fixture.teams.home.id) ?? null;
        let awayDbId = teamIdMap.get(fixture.teams.away.id) ?? null;

        // If we don't have the team in our map yet, try to look it up in the DB
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

        const matchDbId = await upsertFootballMatch(transformed, homeDbId, awayDbId);
        matchesSynced++;

        // ── 3. Statistics (completed matches only) ─────────────────────────

        if (transformed.status === 'completed') {
          const statsData = await fetchMatchStatistics(fixture.fixture.id);
          if (statsData) {
            for (const teamStats of statsData) {
              const teamDbId = teamIdMap.get(teamStats.team.id)
                ?? (await sql<{ id: number }[]>`SELECT id FROM football_teams WHERE api_id = ${teamStats.team.id}`)[0]?.id
                ?? null;

              if (teamDbId === null) {
                console.warn(`Stats: unknown team api_id ${teamStats.team.id} for fixture ${fixture.fixture.id}`);
                continue;
              }

              try {
                await upsertMatchStats(matchDbId, teamDbId, teamStats.statistics);
                statsSynced++;
              } catch (err) {
                console.error(`Error upserting stats for fixture ${fixture.fixture.id}:`, err instanceof Error ? err.message : err);
                errors++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error syncing fixture ${rawFixture.fixture.id}:`, err instanceof Error ? err.message : err);
        errors++;
      }
    }

    console.log(`${league.name} done — teams: ${teamsSynced}, matches: ${matchesSynced}, stats: ${statsSynced}`);
  }

  const message = errors === 0
    ? `Successfully synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records`
    : `Synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records with ${errors} error(s)`;

  console.log(`Football sync complete — ${message}`);
  return { teams_synced: teamsSynced, matches_synced: matchesSynced, stats_synced: statsSynced, errors, message };
}
