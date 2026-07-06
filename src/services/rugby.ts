/**
 * API-Rugby integration
 *
 * Fetches team, match, and statistics data from v1.rugby.api-sports.io
 * for the following competition:
 *   - NRL (league_id: 3, season: 2025)
 *
 * All data is upserted into the rugby_* tables so the function is safe
 * to call repeatedly without creating duplicates.
 */

import axios from 'axios';
import { sql } from '../db.js';
import type { RugbySyncResult } from '../types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const RUGBY_API_BASE_URL = 'https://v1.rugby.api-sports.io';
const RUGBY_API_KEY = '404f293f746d43be3efd5457c97406d1';

/** Leagues and seasons to sync. */
const LEAGUES: Array<{ leagueId: number; season: number; name: string }> = [
  { leagueId: 3, season: 2025, name: 'NRL' },
];

// ── Raw API response types ────────────────────────────────────────────────────

interface ApiRugbyTeam {
  id: number;
  name: string;
  logo: string | null;
  country: {
    name: string | null;
    code: string | null;
    flag: string | null;
  } | null;
}

interface ApiTeamsEnvelope {
  response: ApiRugbyTeam[];
}

interface ApiRugbyGame {
  id: number;
  date: string | null;
  time: string | null;
  timestamp: number | null;
  timezone: string | null;
  week: string | null;
  status: {
    long: string;
    short: string;
    timer: string | null;
  };
  league: {
    id: number;
    name: string;
    season: string | number;
    logo: string | null;
  };
  country: {
    name: string | null;
    code: string | null;
    flag: string | null;
  } | null;
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  scores: {
    home: number | null;
    away: number | null;
  };
  periods: {
    first: number | null;
    second: number | null;
  } | null;
  venue: string | null;
  referee: string | null;
}

interface ApiGamesEnvelope {
  response: ApiRugbyGame[];
}

interface ApiRugbyStatEntry {
  type: string;
  value: string | number | null;
}

interface ApiRugbyTeamStats {
  team: { id: number; name: string };
  statistics: ApiRugbyStatEntry[];
}

interface ApiStatsEnvelope {
  response: ApiRugbyTeamStats[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared axios instance with auth header pre-configured. */
const rugbyApi = axios.create({
  baseURL: RUGBY_API_BASE_URL,
  headers: { 'x-apisports-key': RUGBY_API_KEY },
  timeout: 15000,
});

/**
 * Map an API-Rugby status short code to a human-readable status string.
 */
function mapStatus(short: string): string {
  switch (short) {
    case 'FT':
    case 'AET':
      return 'completed';
    case '1H':
    case '2H':
    case 'HT':
    case 'ET':
    case 'BT':
    case 'PT':
      return 'in_progress';
    case 'POST':
    case 'CANC':
    case 'INTR':
    case 'ABD':
      return 'other';
    default:
      return 'scheduled'; // NS, TBD, etc.
  }
}

/**
 * Parse a raw stat value from the API into a number (or null).
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
function getStat(stats: ApiRugbyStatEntry[], type: string): number | null {
  const entry = stats.find(s => s.type === type);
  return entry ? parseStat(entry.value) : null;
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * Fetch all teams for a given league and season from API-Rugby.
 * Returns the raw response array, or null on failure.
 */
export async function fetchRugbyTeams(
  leagueId: number,
  season: number,
): Promise<ApiRugbyTeam[] | null> {
  try {
    const res = await rugbyApi.get<ApiTeamsEnvelope>('/teams', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchRugbyTeams: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchRugbyTeams failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch all games for a given league and season from API-Rugby.
 * Returns the raw response array, or null on failure.
 */
export async function fetchRugbyMatches(
  leagueId: number,
  season: number,
): Promise<ApiRugbyGame[] | null> {
  try {
    const res = await rugbyApi.get<ApiGamesEnvelope>('/games', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchRugbyMatches: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchRugbyMatches failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch statistics for a single game from API-Rugby.
 * Returns the raw response array, or null on failure.
 */
export async function fetchMatchStatistics(
  gameId: number,
): Promise<ApiRugbyTeamStats[] | null> {
  try {
    const res = await rugbyApi.get<ApiStatsEnvelope>('/games/statistics', {
      params: { id: gameId },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) return null;
    return data;
  } catch (err) {
    console.error(
      `fetchMatchStatistics failed (game=${gameId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Transform a raw API-Rugby game into the shape expected by the
 * rugby_matches table.  Returns a plain object — no DB calls.
 */
export function transformRugbyMatch(apiMatch: ApiRugbyGame) {
  // API-Rugby returns season as a string like "2025" or a number
  const season = apiMatch.league.season !== null && apiMatch.league.season !== undefined
    ? parseInt(String(apiMatch.league.season), 10)
    : null;

  // Build a full ISO date string from date + time fields if available
  let date: Date | null = null;
  if (apiMatch.timestamp) {
    date = new Date(apiMatch.timestamp * 1000);
  } else if (apiMatch.date) {
    date = new Date(apiMatch.date);
  }

  return {
    api_id: apiMatch.id,
    league_id: apiMatch.league.id,
    league_name: apiMatch.league.name ?? null,
    season: isNaN(season as number) ? null : season,
    round: apiMatch.week ?? null,
    home_team_api_id: apiMatch.teams.home.id,
    away_team_api_id: apiMatch.teams.away.id,
    home_team_name: apiMatch.teams.home.name,
    away_team_name: apiMatch.teams.away.name,
    date,
    home_score: apiMatch.scores.home ?? null,
    away_score: apiMatch.scores.away ?? null,
    status: mapStatus(apiMatch.status.short),
    venue: apiMatch.venue ?? null,
    referee: apiMatch.referee ?? null,
  };
}

// ── Database helpers ──────────────────────────────────────────────────────────

/**
 * Upsert a rugby team and return its internal DB id.
 */
async function upsertRugbyTeam(team: ApiRugbyTeam): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO rugby_teams (api_id, name, logo_url, country, updated_at)
    VALUES (
      ${team.id},
      ${team.name},
      ${team.logo ?? null},
      ${team.country?.name ?? null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (api_id) DO UPDATE SET
      name       = EXCLUDED.name,
      logo_url   = EXCLUDED.logo_url,
      country    = EXCLUDED.country,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return rows[0].id;
}

/**
 * Upsert a rugby match row.  Requires the internal DB ids for both teams.
 * Returns the internal DB id of the upserted match.
 */
async function upsertRugbyMatch(
  transformed: ReturnType<typeof transformRugbyMatch>,
  homeDbId: number | null,
  awayDbId: number | null,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO rugby_matches (
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
  stats: ApiRugbyStatEntry[],
): Promise<void> {
  await sql`
    INSERT INTO rugby_match_stats (
      match_id, team_id,
      tries, goals, field_goals,
      tackles, offloads, passes, runs,
      line_breaks, errors, penalties,
      updated_at
    )
    VALUES (
      ${matchDbId}, ${teamDbId},
      ${getStat(stats, 'Tries')},
      ${getStat(stats, 'Goals')},
      ${getStat(stats, 'Field Goals')},
      ${getStat(stats, 'Tackles')},
      ${getStat(stats, 'Offloads')},
      ${getStat(stats, 'Passes')},
      ${getStat(stats, 'Runs')},
      ${getStat(stats, 'Line Breaks')},
      ${getStat(stats, 'Errors')},
      ${getStat(stats, 'Penalties')},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (match_id, team_id) DO UPDATE SET
      tries        = EXCLUDED.tries,
      goals        = EXCLUDED.goals,
      field_goals  = EXCLUDED.field_goals,
      tackles      = EXCLUDED.tackles,
      offloads     = EXCLUDED.offloads,
      passes       = EXCLUDED.passes,
      runs         = EXCLUDED.runs,
      line_breaks  = EXCLUDED.line_breaks,
      errors       = EXCLUDED.errors,
      penalties    = EXCLUDED.penalties,
      updated_at   = CURRENT_TIMESTAMP
  `;
}

// ── Main sync orchestrator ────────────────────────────────────────────────────

/**
 * Sync all rugby data (teams, matches, stats) for every configured league.
 *
 * Strategy:
 *  1. For each league, fetch and upsert teams first so FK references exist.
 *  2. Fetch and upsert games, resolving team api_id → internal DB id.
 *  3. For completed matches only, fetch and upsert per-team statistics.
 *     (Stats are only available once a match has finished.)
 */
export async function syncRugbyData(): Promise<RugbySyncResult> {
  let teamsSynced = 0;
  let matchesSynced = 0;
  let statsSynced = 0;
  let errors = 0;

  for (const league of LEAGUES) {
    console.log(`Syncing ${league.name} (league=${league.leagueId}, season=${league.season})…`);

    // ── 1. Teams ────────────────────────────────────────────────────────────

    const teamsData = await fetchRugbyTeams(league.leagueId, league.season);
    /** Map from API team id → internal DB id, built as we upsert. */
    const teamIdMap = new Map<number, number>();

    if (teamsData) {
      for (const team of teamsData) {
        try {
          const dbId = await upsertRugbyTeam(team);
          teamIdMap.set(team.id, dbId);
          teamsSynced++;
        } catch (err) {
          console.error(`Error upserting team ${team.name}:`, err instanceof Error ? err.message : err);
          errors++;
        }
      }
    } else {
      console.warn(`No team data for ${league.name} — skipping team upsert`);
    }

    // ── 2. Games ─────────────────────────────────────────────────────────────

    const gamesData = await fetchRugbyMatches(league.leagueId, league.season);

    if (!gamesData) {
      console.warn(`No game data for ${league.name} — skipping`);
      continue;
    }

    for (const game of gamesData) {
      try {
        const transformed = transformRugbyMatch(game);

        // Resolve team api_ids to internal DB ids (may be null if team wasn't fetched)
        let homeDbId = teamIdMap.get(game.teams.home.id) ?? null;
        let awayDbId = teamIdMap.get(game.teams.away.id) ?? null;

        // If we don't have the team in our map yet, try to look it up in the DB
        if (homeDbId === null) {
          const rows = await sql<{ id: number }[]>`
            SELECT id FROM rugby_teams WHERE api_id = ${game.teams.home.id}
          `;
          homeDbId = rows[0]?.id ?? null;
        }
        if (awayDbId === null) {
          const rows = await sql<{ id: number }[]>`
            SELECT id FROM rugby_teams WHERE api_id = ${game.teams.away.id}
          `;
          awayDbId = rows[0]?.id ?? null;
        }

        const matchDbId = await upsertRugbyMatch(transformed, homeDbId, awayDbId);
        matchesSynced++;

        // ── 3. Statistics (completed matches only) ──────────────────────────

        if (transformed.status === 'completed') {
          const statsData = await fetchMatchStatistics(game.id);
          if (statsData) {
            for (const teamStats of statsData) {
              const teamDbId = teamIdMap.get(teamStats.team.id)
                ?? (await sql<{ id: number }[]>`SELECT id FROM rugby_teams WHERE api_id = ${teamStats.team.id}`)[0]?.id
                ?? null;

              if (teamDbId === null) {
                console.warn(`Stats: unknown team api_id ${teamStats.team.id} for game ${game.id}`);
                continue;
              }

              try {
                await upsertMatchStats(matchDbId, teamDbId, teamStats.statistics);
                statsSynced++;
              } catch (err) {
                console.error(`Error upserting stats for game ${game.id}:`, err instanceof Error ? err.message : err);
                errors++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error syncing game ${game.id}:`, err instanceof Error ? err.message : err);
        errors++;
      }
    }

    console.log(`${league.name} done — teams: ${teamsSynced}, matches: ${matchesSynced}, stats: ${statsSynced}`);
  }

  const message = errors === 0
    ? `Successfully synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records`
    : `Synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records with ${errors} error(s)`;

  console.log(`Rugby sync complete — ${message}`);
  return { teams_synced: teamsSynced, matches_synced: matchesSynced, stats_synced: statsSynced, errors, message };
}
