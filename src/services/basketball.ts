/**
 * API-Sports Basketball integration
 *
 * Fetches team, match, and statistics data from v1.basketball.api-sports.io
 * for the following competition:
 *   - NBA (league_id: 12, season: 2024-2025)
 *
 * All data is upserted into the basketball_* tables so the function is safe
 * to call repeatedly without creating duplicates.
 */

import axios from 'axios';
import { sql } from '../db.js';
import type { BasketballSyncResult } from '../types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASKETBALL_API_BASE_URL = 'https://v1.basketball.api-sports.io';
const BASKETBALL_API_KEY = '404f293f746d43be3efd5457c97406d1';

/** Leagues and seasons to sync. */
const LEAGUES: Array<{ leagueId: number; season: string; name: string }> = [
  { leagueId: 12, season: '2024-2025', name: 'NBA' },
];

// ── Raw API response types ────────────────────────────────────────────────────

interface ApiBasketballTeam {
  id: number;
  name: string;
  logo: string | null;
  national: boolean;
  country: {
    id: number | null;
    name: string | null;
    code: string | null;
    flag: string | null;
  } | null;
}

interface ApiTeamsEnvelope {
  response: ApiBasketballTeam[];
}

interface ApiBasketballGame {
  id: number;
  date: string | null;
  time: string | null;
  timestamp: number | null;
  timezone: string | null;
  week: string | null;
  stage: string | null;
  status: {
    long: string;
    short: string;
    timer: string | null;
  };
  league: {
    id: number;
    name: string;
    season: string;
    logo: string | null;
  };
  country: {
    id: number | null;
    name: string | null;
    code: string | null;
    flag: string | null;
  } | null;
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  scores: {
    home: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      over_time: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      over_time: number | null;
      total: number | null;
    };
  };
  venue: string | null;
}

interface ApiGamesEnvelope {
  response: ApiBasketballGame[];
}

interface ApiBasketballStatEntry {
  type: string;
  value: string | number | null;
}

interface ApiBasketballTeamStats {
  team: { id: number; name: string };
  statistics: ApiBasketballStatEntry[];
}

interface ApiStatsEnvelope {
  response: ApiBasketballTeamStats[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared axios instance with auth header pre-configured. */
const basketballApi = axios.create({
  baseURL: BASKETBALL_API_BASE_URL,
  headers: { 'x-apisports-key': BASKETBALL_API_KEY },
  timeout: 15000,
});

/**
 * Map an API-Sports Basketball status short code to a human-readable status string.
 * NS = Not Started, FT = Full Time, 1Q/2Q/3Q/4Q = quarters, OT = overtime
 */
function mapStatus(short: string): string {
  switch (short) {
    case 'FT':
    case 'AOT':
      return 'completed';
    case '1Q':
    case '2Q':
    case '3Q':
    case '4Q':
    case 'OT':
    case 'HT':
    case 'BT':
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
function getStat(stats: ApiBasketballStatEntry[], type: string): number | null {
  const entry = stats.find(s => s.type === type);
  return entry ? parseStat(entry.value) : null;
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * Fetch all teams for a given league and season from API-Sports Basketball.
 * Returns the raw response array, or null on failure.
 */
export async function fetchBasketballTeams(
  leagueId: number,
  season: string,
): Promise<ApiBasketballTeam[] | null> {
  try {
    const res = await basketballApi.get<ApiTeamsEnvelope>('/teams', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchBasketballTeams: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchBasketballTeams failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch all games for a given league and season from API-Sports Basketball.
 * Returns the raw response array, or null on failure.
 */
export async function fetchBasketballMatches(
  leagueId: number,
  season: string,
): Promise<ApiBasketballGame[] | null> {
  try {
    const res = await basketballApi.get<ApiGamesEnvelope>('/games', {
      params: { league: leagueId, season },
    });
    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn(`fetchBasketballMatches: unexpected response for league ${leagueId}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `fetchBasketballMatches failed (league=${leagueId}, season=${season}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch statistics for a single game from API-Sports Basketball.
 * Returns the raw response array, or null on failure.
 */
export async function fetchMatchStatistics(
  gameId: number,
): Promise<ApiBasketballTeamStats[] | null> {
  try {
    const res = await basketballApi.get<ApiStatsEnvelope>('/games/statistics', {
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
 * Transform a raw API-Sports Basketball game into the shape expected by the
 * basketball_matches table.  Returns a plain object — no DB calls.
 */
export function transformBasketballMatch(apiMatch: ApiBasketballGame) {
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
    season: apiMatch.league.season ?? null,
    round: apiMatch.week ?? apiMatch.stage ?? null,
    home_team_api_id: apiMatch.teams.home.id,
    away_team_api_id: apiMatch.teams.away.id,
    home_team_name: apiMatch.teams.home.name,
    away_team_name: apiMatch.teams.away.name,
    date,
    home_score: apiMatch.scores.home.total ?? null,
    away_score: apiMatch.scores.away.total ?? null,
    status: mapStatus(apiMatch.status.short),
    venue: apiMatch.venue ?? null,
  };
}

// ── Database helpers ──────────────────────────────────────────────────────────

/**
 * Upsert a basketball team and return its internal DB id.
 */
async function upsertBasketballTeam(team: ApiBasketballTeam): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO basketball_teams (api_id, name, logo_url, country, updated_at)
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
 * Upsert a basketball match row.  Requires the internal DB ids for both teams.
 * Returns the internal DB id of the upserted match.
 */
async function upsertBasketballMatch(
  transformed: ReturnType<typeof transformBasketballMatch>,
  homeDbId: number | null,
  awayDbId: number | null,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO basketball_matches (
      api_id, league_id, league_name, season, round,
      home_team_id, away_team_id, home_team_name, away_team_name,
      date, home_score, away_score, status, venue,
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
  stats: ApiBasketballStatEntry[],
): Promise<void> {
  await sql`
    INSERT INTO basketball_match_stats (
      match_id, team_id,
      points,
      field_goals_made, field_goals_attempted,
      three_pointers_made, three_pointers_attempted,
      free_throws_made, free_throws_attempted,
      rebounds, assists, steals, blocks, turnovers, fouls,
      updated_at
    )
    VALUES (
      ${matchDbId}, ${teamDbId},
      ${getStat(stats, 'Points')},
      ${getStat(stats, 'Field Goals Made')},
      ${getStat(stats, 'Field Goals Attempted')},
      ${getStat(stats, 'Three Points Made')},
      ${getStat(stats, 'Three Points Attempted')},
      ${getStat(stats, 'Free Throws Made')},
      ${getStat(stats, 'Free Throws Attempted')},
      ${getStat(stats, 'Total Rebounds')},
      ${getStat(stats, 'Assists')},
      ${getStat(stats, 'Steals')},
      ${getStat(stats, 'Blocks')},
      ${getStat(stats, 'Turnovers')},
      ${getStat(stats, 'Personal Fouls')},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (match_id, team_id) DO UPDATE SET
      points                   = EXCLUDED.points,
      field_goals_made         = EXCLUDED.field_goals_made,
      field_goals_attempted    = EXCLUDED.field_goals_attempted,
      three_pointers_made      = EXCLUDED.three_pointers_made,
      three_pointers_attempted = EXCLUDED.three_pointers_attempted,
      free_throws_made         = EXCLUDED.free_throws_made,
      free_throws_attempted    = EXCLUDED.free_throws_attempted,
      rebounds                 = EXCLUDED.rebounds,
      assists                  = EXCLUDED.assists,
      steals                   = EXCLUDED.steals,
      blocks                   = EXCLUDED.blocks,
      turnovers                = EXCLUDED.turnovers,
      fouls                    = EXCLUDED.fouls,
      updated_at               = CURRENT_TIMESTAMP
  `;
}

// ── Main sync orchestrator ────────────────────────────────────────────────────

/**
 * Sync all basketball data (teams, matches, stats) for every configured league.
 *
 * Strategy:
 *  1. Delete matches older than 60 days to keep the database lean.
 *  2. For each league, fetch and upsert teams first so FK references exist.
 *  3. Fetch and upsert games, skipping any that fall outside the last 60 days.
 *  4. For completed matches only, fetch and upsert per-team statistics.
 *     (Stats are only available once a match has finished.)
 */
export async function syncBasketballData(): Promise<BasketballSyncResult> {
  let teamsSynced = 0;
  let matchesSynced = 0;
  let statsSynced = 0;
  let errors = 0;

  // Compute the cutoff timestamp (60 days ago) once for the whole sync run
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  // Remove matches older than 60 days before syncing to keep the DB lean
  try {
    await sql`DELETE FROM basketball_matches WHERE date < NOW() - INTERVAL '60 days'`;
    console.log('Basketball sync: pruned matches older than 60 days');
  } catch (err) {
    console.error('Basketball sync: failed to prune old matches:', err instanceof Error ? err.message : err);
  }

  for (const league of LEAGUES) {
    console.log(`Syncing ${league.name} (league=${league.leagueId}, season=${league.season}, last 60 days)…`);

    // ── 1. Teams ────────────────────────────────────────────────────────────

    const teamsData = await fetchBasketballTeams(league.leagueId, league.season);
    /** Map from API team id → internal DB id, built as we upsert. */
    const teamIdMap = new Map<number, number>();

    if (teamsData) {
      for (const team of teamsData) {
        try {
          const dbId = await upsertBasketballTeam(team);
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

    // ── 2. Games (last 60 days only) ─────────────────────────────────────────

    const gamesData = await fetchBasketballMatches(league.leagueId, league.season);

    if (!gamesData) {
      console.warn(`No game data for ${league.name} — skipping`);
      continue;
    }

    for (const game of gamesData) {
      try {
        const transformed = transformBasketballMatch(game);

        // Skip matches outside the 60-day window
        if (transformed.date !== null && transformed.date < cutoff) continue;

        // Resolve team api_ids to internal DB ids (may be null if team wasn't fetched)
        let homeDbId = teamIdMap.get(game.teams.home.id) ?? null;
        let awayDbId = teamIdMap.get(game.teams.away.id) ?? null;

        // If we don't have the team in our map yet, try to look it up in the DB
        if (homeDbId === null) {
          const rows = await sql<{ id: number }[]>`
            SELECT id FROM basketball_teams WHERE api_id = ${game.teams.home.id}
          `;
          homeDbId = rows[0]?.id ?? null;
        }
        if (awayDbId === null) {
          const rows = await sql<{ id: number }[]>`
            SELECT id FROM basketball_teams WHERE api_id = ${game.teams.away.id}
          `;
          awayDbId = rows[0]?.id ?? null;
        }

        const matchDbId = await upsertBasketballMatch(transformed, homeDbId, awayDbId);
        matchesSynced++;

        // ── 3. Statistics (completed matches only) ──────────────────────────

        if (transformed.status === 'completed') {
          const statsData = await fetchMatchStatistics(game.id);
          if (statsData) {
            for (const teamStats of statsData) {
              const teamDbId = teamIdMap.get(teamStats.team.id)
                ?? (await sql<{ id: number }[]>`SELECT id FROM basketball_teams WHERE api_id = ${teamStats.team.id}`)[0]?.id
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
    ? `Successfully synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records (last 60 days)`
    : `Synced ${teamsSynced} teams, ${matchesSynced} matches, ${statsSynced} stat records (last 60 days) with ${errors} error(s)`;

  console.log(`Basketball sync complete — ${message}`);
  return { teams_synced: teamsSynced, matches_synced: matchesSynced, stats_synced: statsSynced, errors, message };
}
