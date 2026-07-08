/**
 * World Cup 2026 sync
 *
 * Fetches fixture and event data from v3.football.api-sports.io for the
 * FIFA World Cup 2026 (league_id: 1, season: 2026) and stores them in the
 * generic `matches` and `match_events` tables.
 *
 * Only matches from the last 60 days are inserted so the table stays lean.
 * Both inserts use ON CONFLICT DO NOTHING to avoid duplicates on re-runs.
 */

import axios from 'axios';
import { sql } from '../db.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FOOTBALL_API_BASE_URL = 'https://v3.football.api-sports.io';
const FOOTBALL_API_KEY = '404f293f746d43be3efd5457c97406d1';

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

// ── Raw API response types ────────────────────────────────────────────────────

interface ApiEvent {
  time: {
    elapsed: number | null;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  type: string | null;
  detail: string | null;
  comments: string | null;
}

interface ApiFixtureWithEvents {
  fixture: {
    id: number;
    date: string | null;
    status: { short: string };
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  score: {
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events: ApiEvent[] | null;
}

interface ApiFixturesEnvelope {
  response: ApiFixtureWithEvents[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared axios instance with auth header pre-configured. */
const footballApi = axios.create({
  baseURL: FOOTBALL_API_BASE_URL,
  headers: { 'x-apisports-key': FOOTBALL_API_KEY },
  timeout: 15000,
});

/**
 * Map an API-Football status short code to our internal match status.
 */
function mapStatus(short: string): 'scheduled' | 'in_progress' | 'completed' {
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
      return 'scheduled';
  }
}

/**
 * Upsert a team into the generic `teams` table and return its internal id.
 */
async function upsertTeam(name: string): Promise<number> {
  // Derive a short abbreviation: first letter of each word, up to 3 chars
  const abbreviation = name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3);

  const rows = await sql<{ id: number }[]>`
    INSERT INTO teams (name, abbreviation)
    VALUES (${name}, ${abbreviation})
    ON CONFLICT (name) DO UPDATE SET abbreviation = EXCLUDED.abbreviation
    RETURNING id
  `;
  return rows[0].id;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all World Cup 2026 fixtures (including events) from the API.
 * The `events=true` query param instructs the API to embed event arrays.
 * Returns an empty array on failure.
 */
async function fetchWorldCupFixtures(): Promise<ApiFixtureWithEvents[]> {
  try {
    const res = await footballApi.get<ApiFixturesEnvelope>('/fixtures', {
      params: {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
      },
    });

    const data = res.data?.response;
    if (!Array.isArray(data)) {
      console.warn('World Cup sync: unexpected API response shape');
      return [];
    }

    return data;
  } catch (err) {
    console.error(
      'World Cup sync: failed to fetch fixtures:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ── Public sync function ──────────────────────────────────────────────────────

export interface WorldCupSyncStats {
  synced: number;
  errors: number;
}

/**
 * Fetch World Cup 2026 fixtures from the Football API and upsert them into
 * the `matches` and `match_events` tables.
 *
 * Only matches from the last 60 days are processed.  Each match is inserted
 * with ON CONFLICT DO NOTHING so repeated runs are safe.  Events are inserted
 * the same way.
 *
 * Score JSON shape stored in home_score / away_score:
 * ```json
 * { "regular": { "home": 3, "away": 2 },
 *   "extra":   { "home": 0, "away": 0 },
 *   "penalty": { "home": 4, "away": 3 } }
 * ```
 */
export async function syncWorldCupData(): Promise<WorldCupSyncStats> {
  // Compute the 60-day cutoff once
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 60);

  const fixtures = await fetchWorldCupFixtures();

  // Filter to the last 60 days
  const recent = fixtures.filter(f => {
    if (!f.fixture.date) return false;
    const matchDate = new Date(f.fixture.date);
    return !isNaN(matchDate.getTime()) && matchDate >= cutoff;
  });

  console.log(
    `World Cup sync: ${fixtures.length} total fixtures, ${recent.length} within last 60 days`,
  );

  let synced = 0;
  let errors = 0;

  for (const f of recent) {
    try {
      // ── Upsert teams ────────────────────────────────────────────────────────
      const homeTeamId = await upsertTeam(f.teams.home.name);
      const awayTeamId = await upsertTeam(f.teams.away.name);

      // ── Build score JSON ────────────────────────────────────────────────────
      const homeScoreJson = {
        regular: {
          home: f.score.fulltime.home ?? null,
          away: f.score.fulltime.away ?? null,
        },
        extra: {
          home: f.score.extratime.home ?? null,
          away: f.score.extratime.away ?? null,
        },
        penalty: {
          home: f.score.penalty.home ?? null,
          away: f.score.penalty.away ?? null,
        },
        winner: f.teams.home.winner,
      };

      const awayScoreJson = {
        regular: {
          home: f.score.fulltime.home ?? null,
          away: f.score.fulltime.away ?? null,
        },
        extra: {
          home: f.score.extratime.home ?? null,
          away: f.score.extratime.away ?? null,
        },
        penalty: {
          home: f.score.penalty.home ?? null,
          away: f.score.penalty.away ?? null,
        },
        winner: f.teams.away.winner,
      };

      const round = f.league.round ?? 'Unknown';
      const matchDate = f.fixture.date ? new Date(f.fixture.date) : null;
      const status = mapStatus(f.fixture.status.short);

      // ── Insert match ────────────────────────────────────────────────────────
      const matchRows = await sql<{ id: number }[]>`
        INSERT INTO matches (round, home_team_id, away_team_id, date, home_score, away_score, status)
        VALUES (
          ${round},
          ${homeTeamId},
          ${awayTeamId},
          ${matchDate},
          ${JSON.stringify(homeScoreJson)},
          ${JSON.stringify(awayScoreJson)},
          ${status}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // If ON CONFLICT DO NOTHING fired (duplicate), matchRows will be empty —
      // look up the existing row so we can still insert any new events.
      let matchDbId: number | null = matchRows[0]?.id ?? null;
      if (matchDbId === null) {
        const existing = await sql<{ id: number }[]>`
          SELECT id FROM matches
          WHERE home_team_id = ${homeTeamId}
            AND away_team_id = ${awayTeamId}
            AND date = ${matchDate}
          LIMIT 1
        `;
        matchDbId = existing[0]?.id ?? null;
      }

      synced++;

      // ── Insert events ───────────────────────────────────────────────────────
      if (matchDbId !== null && Array.isArray(f.events) && f.events.length > 0) {
        for (const event of f.events) {
          try {
            await sql`
              INSERT INTO match_events (
                match_id, type, player, team, elapsed, extra, detail, comments
              )
              VALUES (
                ${matchDbId},
                ${event.type ?? null},
                ${event.player?.name ?? null},
                ${event.team?.name ?? null},
                ${event.time?.elapsed ?? null},
                ${event.time?.extra ?? null},
                ${event.detail ?? null},
                ${event.comments ?? null}
              )
              ON CONFLICT DO NOTHING
            `;
          } catch (evtErr) {
            console.error(
              `World Cup sync: error inserting event for match ${matchDbId}:`,
              evtErr instanceof Error ? evtErr.message : evtErr,
            );
            // Don't increment errors for individual event failures —
            // the match itself was synced successfully.
          }
        }
      }
    } catch (err) {
      console.error(
        `World Cup sync: error processing fixture ${f.fixture.id}:`,
        err instanceof Error ? err.message : err,
      );
      errors++;
    }
  }

  console.log(`World Cup sync complete — synced: ${synced}, errors: ${errors}`);
  return { synced, errors };
}
