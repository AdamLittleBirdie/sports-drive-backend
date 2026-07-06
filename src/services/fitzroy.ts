/**
 * Fitzroy API integration
 *
 * Fetches real-time AFL fixture data from API-Sports (v3.afl.api-sports.io).
 * API-Sports provides current and upcoming AFL matches, teams, and scores
 * via a REST API authenticated with an x-apisports-key header.
 *
 * Falls back to a curated static dataset when the upstream is unavailable
 * so the service always starts cleanly.
 */

import axios from 'axios';
import { sql } from '../db.js';

// ── Types for raw Fitzroy / afltables payloads ────────────────────────────────

interface FitzroyMatch {
  Round: string;
  Date: string;
  'Home.Team': string;
  'Away.Team': string;
  'Home.Points': number | null;
  'Away.Points': number | null;
  Season: number;
  /** Pre-resolved status from the upstream API, if available. */
  Status?: 'scheduled' | 'in_progress' | 'completed';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a short abbreviation from a team name.
 * e.g. "Greater Western Sydney" → "GWS", "Richmond" → "RIC"
 */
function abbreviate(name: string): string {
  const known: Record<string, string> = {
    'Adelaide': 'ADE',
    'Brisbane Lions': 'BRL',
    'Carlton': 'CAR',
    'Collingwood': 'COL',
    'Essendon': 'ESS',
    'Fremantle': 'FRE',
    'Geelong': 'GEE',
    'Gold Coast': 'GCS',
    'Greater Western Sydney': 'GWS',
    'GWS Giants': 'GWS',
    'Hawthorn': 'HAW',
    'Melbourne': 'MEL',
    'North Melbourne': 'NME',
    'Port Adelaide': 'PAD',
    'Richmond': 'RIC',
    'St Kilda': 'STK',
    'Sydney': 'SYD',
    'West Coast': 'WCE',
    'Western Bulldogs': 'WBD',
  };
  if (known[name]) return known[name];
  // Fallback: first 3 uppercase letters
  return name.replace(/[^A-Za-z ]/g, '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

/**
 * Upsert a team row and return its id.
 */
async function upsertTeam(name: string): Promise<number> {
  const abbr = abbreviate(name);
  const rows = await sql<{ id: number }[]>`
    INSERT INTO teams (name, abbreviation)
    VALUES (${name}, ${abbr})
    ON CONFLICT (name) DO UPDATE SET abbreviation = EXCLUDED.abbreviation
    RETURNING id
  `;
  return rows[0].id;
}

/**
 * Determine match status from scores.
 */
function matchStatus(
  homeScore: number | null,
  awayScore: number | null,
  dateStr: string,
): 'scheduled' | 'in_progress' | 'completed' {
  if (homeScore !== null && awayScore !== null) return 'completed';
  const matchDate = new Date(dateStr);
  if (!isNaN(matchDate.getTime()) && matchDate < new Date()) return 'in_progress';
  return 'scheduled';
}

// ── Seed data (used when upstream is unavailable) ─────────────────────────────

const SEED_MATCHES: FitzroyMatch[] = [
  { Season: 2024, Round: 'Round 1', Date: '2024-03-07', 'Home.Team': 'Carlton', 'Away.Team': 'Richmond', 'Home.Points': 87, 'Away.Points': 62 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-08', 'Home.Team': 'Collingwood', 'Away.Team': 'Melbourne', 'Home.Points': 101, 'Away.Points': 78 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-08', 'Home.Team': 'Geelong', 'Away.Team': 'Hawthorn', 'Home.Points': 95, 'Away.Points': 84 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-09', 'Home.Team': 'Sydney', 'Away.Team': 'Essendon', 'Home.Points': 110, 'Away.Points': 73 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-09', 'Home.Team': 'Brisbane Lions', 'Away.Team': 'Gold Coast', 'Home.Points': 88, 'Away.Points': 65 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-09', 'Home.Team': 'Fremantle', 'Away.Team': 'West Coast', 'Home.Points': 92, 'Away.Points': 71 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-10', 'Home.Team': 'Port Adelaide', 'Away.Team': 'Adelaide', 'Home.Points': 79, 'Away.Points': 68 },
  { Season: 2024, Round: 'Round 1', Date: '2024-03-10', 'Home.Team': 'Greater Western Sydney', 'Away.Team': 'North Melbourne', 'Home.Points': 105, 'Away.Points': 54 },
  { Season: 2024, Round: 'Round 2', Date: '2024-03-14', 'Home.Team': 'Richmond', 'Away.Team': 'Collingwood', 'Home.Points': 74, 'Away.Points': 98 },
  { Season: 2024, Round: 'Round 2', Date: '2024-03-15', 'Home.Team': 'Melbourne', 'Away.Team': 'Carlton', 'Home.Points': 83, 'Away.Points': 91 },
  { Season: 2024, Round: 'Round 2', Date: '2024-03-16', 'Home.Team': 'Hawthorn', 'Away.Team': 'Sydney', 'Home.Points': 77, 'Away.Points': 102 },
  { Season: 2024, Round: 'Round 2', Date: '2024-03-16', 'Home.Team': 'Essendon', 'Away.Team': 'Geelong', 'Home.Points': 69, 'Away.Points': 88 },
  { Season: 2024, Round: 'Round 3', Date: '2024-03-21', 'Home.Team': 'Carlton', 'Away.Team': 'Collingwood', 'Home.Points': null, 'Away.Points': null },
  { Season: 2024, Round: 'Round 3', Date: '2024-03-22', 'Home.Team': 'Richmond', 'Away.Team': 'Melbourne', 'Home.Points': null, 'Away.Points': null },
];

// ── API-Sports response types ─────────────────────────────────────────────────

interface ApiSportsFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long: string;
    };
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

interface ApiSportsResponse {
  response: ApiSportsFixture[];
}

// ── Fetch from upstream ───────────────────────────────────────────────────────

const API_SPORTS_BASE_URL = 'https://v3.afl.api-sports.io';
const API_SPORTS_KEY = '404f293f746d43be3efd5457c97406d1';

/**
 * Map an API-Sports status short code to our internal match status.
 */
function apiSportsStatus(short: string): 'scheduled' | 'in_progress' | 'completed' {
  if (short === 'FT' || short === 'AET' || short === 'PEN') return 'completed';
  if (short === 'LIVE' || short === '1H' || short === '2H' || short === 'HT') return 'in_progress';
  return 'scheduled'; // NS (Not Started) and anything else
}

/**
 * Attempt to fetch match data from the API-Sports AFL API.
 * Returns null if the request fails so callers can fall back to seed data.
 */
async function fetchUpstreamMatches(): Promise<FitzroyMatch[] | null> {
  try {
    const response = await axios.get<ApiSportsResponse>(`${API_SPORTS_BASE_URL}/fixtures`, {
      headers: {
        'x-apisports-key': API_SPORTS_KEY,
      },
      timeout: 10000,
    });

    const fixtures = response.data?.response;
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      console.warn('API-Sports returned empty fixtures list');
      return null;
    }

    return fixtures.map((f): FitzroyMatch => {
      const season = f.league?.season ?? new Date(f.fixture.date).getFullYear();
      // API-Sports provides round as e.g. "Round - 5"; normalise to "Round 5"
      const rawRound = f.league?.round ?? '';
      const round = rawRound
        ? rawRound.replace(/^Round\s*-\s*/i, 'Round ').trim()
        : 'Round 1';

      const homePoints = f.goals?.home != null ? f.goals.home * 6 : null;
      const awayPoints = f.goals?.away != null ? f.goals.away * 6 : null;

      return {
        Round: round,
        Date: f.fixture.date,
        'Home.Team': f.teams.home.name,
        'Away.Team': f.teams.away.name,
        'Home.Points': homePoints,
        'Away.Points': awayPoints,
        Season: season,
        Status: apiSportsStatus(f.fixture.status.short),
      };
    });
  } catch (err) {
    console.error('Failed to fetch from API-Sports:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Public sync function ──────────────────────────────────────────────────────

export interface SyncStats {
  synced: number;
  errors: number;
}

/**
 * Fetch AFL match data (upstream first, seed fallback) and upsert into Postgres.
 */
export async function syncFitzroyData(): Promise<SyncStats> {
  let matches = await fetchUpstreamMatches();
  let usedSeed = false;

  if (!matches) {
    console.warn('Upstream Fitzroy data unavailable — using seed dataset');
    matches = SEED_MATCHES;
    usedSeed = true;
  }

  let synced = 0;
  let errors = 0;

  for (const m of matches) {
    try {
      const homeId = await upsertTeam(m['Home.Team']);
      const awayId = await upsertTeam(m['Away.Team']);

      const status = m.Status ?? matchStatus(m['Home.Points'], m['Away.Points'], m.Date);

      await sql`
        INSERT INTO matches (round, home_team_id, away_team_id, date, home_score, away_score, status)
        VALUES (
          ${m.Round},
          ${homeId},
          ${awayId},
          ${m.Date ? new Date(m.Date) : null},
          ${m['Home.Points'] ?? null},
          ${m['Away.Points'] ?? null},
          ${status}
        )
        ON CONFLICT DO NOTHING
      `;
      synced++;
    } catch (err) {
      console.error('Error syncing match:', m, err);
      errors++;
    }
  }

  console.log(`Sync complete — synced: ${synced}, errors: ${errors}${usedSeed ? ' (seed data)' : ''}`);
  return { synced, errors };
}
