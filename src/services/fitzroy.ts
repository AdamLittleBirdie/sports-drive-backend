/**
 * Fitzroy API integration
 *
 * Fetches real-time AFL fixture data from API-Sports (v1.afl.api-sports.io).
 * API-Sports provides current and upcoming AFL matches, teams, and scores
 * via a REST API authenticated with an x-apisports-key header.
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
  'Home.Goals': number | null;
  'Home.Behinds': number | null;
  'Away.Goals': number | null;
  'Away.Behinds': number | null;
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

// ── API-Sports response types ─────────────────────────────────────────────────

interface ApiSportsGame {
  game: {
    id: number;
  };
  league: {
    id: number;
    name: string;
    season: number;
  };
  date: string;
  round: string;
  status: {
    short: string;
    long: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  scores: {
    home: {
      score: number;
      goals: number;
      behinds: number;
    };
    away: {
      score: number;
      goals: number;
      behinds: number;
    };
  };
}

interface ApiSportsGamesResponse {
  response: ApiSportsGame[];
}

// ── Fetch from upstream ───────────────────────────────────────────────────────

const API_SPORTS_BASE_URL = 'https://v1.afl.api-sports.io';
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
 * Returns an empty array if the request fails.
 */
async function fetchUpstreamMatches(): Promise<FitzroyMatch[]> {
  try {
    const response = await axios.get<ApiSportsGamesResponse>(
      `${API_SPORTS_BASE_URL}/games?league=1&season=2026`,
      {
        headers: {
          'x-apisports-key': API_SPORTS_KEY,
        },
        timeout: 10000,
      },
    );

    const games = response.data?.response;
    if (!Array.isArray(games) || games.length === 0) {
      console.warn('API-Sports returned empty games list');
      return [];
    }

    return games.map((g): FitzroyMatch => {
      const season = g.league?.season ?? new Date(g.date).getFullYear();
      // API-Sports provides round as e.g. "Round - 5"; normalise to "Round 5"
      const rawRound = g.round ?? '';
      const round = rawRound
        ? rawRound.replace(/^Round\s*-\s*/i, 'Round ').trim()
        : 'Round 1';

      const hasScores = g.scores?.home?.score != null && g.scores?.away?.score != null;

      return {
        Round: round,
        Date: g.date,
        'Home.Team': g.teams.home.name,
        'Away.Team': g.teams.away.name,
        'Home.Points': hasScores ? g.scores.home.score : null,
        'Away.Points': hasScores ? g.scores.away.score : null,
        'Home.Goals': hasScores ? g.scores.home.goals : null,
        'Home.Behinds': hasScores ? g.scores.home.behinds : null,
        'Away.Goals': hasScores ? g.scores.away.goals : null,
        'Away.Behinds': hasScores ? g.scores.away.behinds : null,
        Season: season,
        Status: apiSportsStatus(g.status.short),
      };
    });
  } catch (err) {
    console.error('Failed to fetch from API-Sports:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Public sync function ──────────────────────────────────────────────────────

export interface SyncStats {
  synced: number;
  errors: number;
}

/**
 * Fetch AFL match data from upstream and upsert into Postgres.
 * Only matches from the last 60 days are inserted; older records are pruned.
 */
export async function syncFitzroyData(): Promise<SyncStats> {
  let matches = await fetchUpstreamMatches();

  // Compute the cutoff date (60 days ago) and filter matches to the window
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 60);
  matches = matches.filter(m => {
    if (!m.Date) return false;
    const matchDate = new Date(m.Date);
    return !isNaN(matchDate.getTime()) && matchDate >= cutoff;
  });

  // Remove AFL matches older than 60 days before syncing to keep the DB lean
  try {
    await sql`DELETE FROM afl_matches WHERE date < NOW() - INTERVAL '60 days'`;
    console.log('AFL sync: pruned matches older than 60 days');
  } catch (err) {
    console.error('AFL sync: failed to prune old matches:', err instanceof Error ? err.message : err);
  }

  let synced = 0;
  let errors = 0;

  for (const m of matches) {
    try {
      const homeId = await upsertTeam(m['Home.Team']);
      const awayId = await upsertTeam(m['Away.Team']);

      const status = m.Status ?? matchStatus(m['Home.Points'], m['Away.Points'], m.Date);

      const homeScoreJson = {
        points: m['Home.Points'] ?? 0,
        goals: m['Home.Goals'] ?? 0,
        behinds: m['Home.Behinds'] ?? 0,
      };
      const awayScoreJson = {
        points: m['Away.Points'] ?? 0,
        goals: m['Away.Goals'] ?? 0,
        behinds: m['Away.Behinds'] ?? 0,
      };

      await sql`
        INSERT INTO afl_matches (round, home_team_id, away_team_id, date, home_score, away_score, status)
        VALUES (
          ${m.Round},
          ${homeId},
          ${awayId},
          ${m.Date ? new Date(m.Date) : null},
          ${JSON.stringify(homeScoreJson)},
          ${JSON.stringify(awayScoreJson)},
          ${status}
        )
        ON CONFLICT (date, home_team_id, away_team_id) DO UPDATE SET 
          status = EXCLUDED.status, 
          home_score = EXCLUDED.home_score, 
          away_score = EXCLUDED.away_score
      `;
      synced++;
    } catch (err) {
      console.error('Error syncing match:', m, err);
      errors++;
    }
  }

  console.log(`AFL sync complete (last 60 days) — synced: ${synced}, errors: ${errors}`);
  return { synced, errors };
}
