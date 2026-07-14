/**
 * Fitzroy API integration
 *
 * Fetches real-time AFL fixture data from API-Sports (v1.afl.api-sports.io).
 * API-Sports provides current and upcoming AFL matches, teams, and scores
 * via a REST API authenticated with an x-apisports-key header.
 */

import axios from 'axios';
import { sql } from '../db.js';
import {
  getMatchStatus,
  generateTeamAbbreviation,
  formatAflScore,
  normalizeRound,
} from '../utils/data.js';

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
 * Upsert a team row and return its id.
 */
async function upsertTeam(name: string): Promise<number> {
  const abbr = generateTeamAbbreviation(name);
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
      const round = rawRound ? normalizeRound(rawRound) : 'Round 1';

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
        Status: getMatchStatus(g.status.short),
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

      const homeScoreJson = formatAflScore(m['Home.Points'], m['Home.Goals'], m['Home.Behinds']);
      const awayScoreJson = formatAflScore(m['Away.Points'], m['Away.Goals'], m['Away.Behinds']);

      await sql`
        INSERT INTO afl_matches (round, home_team_id, away_team_id, date, home_score, away_score, status)
        VALUES (
          ${m.Round},
          ${homeId},
          ${awayId},
          ${m.Date ? new Date(m.Date) : null},
          ${homeScoreJson},
          ${awayScoreJson},
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

/**
 * Fetch all AFL players for a given season across all 18 teams.
 * Called once on startup and monthly on the 1st at 01:00 UTC.
 */
export async function syncAflPlayers(season: number): Promise<SyncStats> {
  let synced = 0;
  let errors = 0;

  // Cycle through all 18 AFL teams
  for (let teamId = 1; teamId <= 18; teamId++) {
    try {
      const response = await axios.get<{ response: Array<{ id: number; name: string }> }>(
        `${API_SPORTS_BASE_URL}/players`,
        {
          params: {
            season,
            team: teamId,
          },
          headers: {
            'x-apisports-key': API_SPORTS_KEY,
          },
          timeout: 10000,
        },
      );

      const players = response.data?.response;
      if (!Array.isArray(players)) {
        console.log(`No players found for team ${teamId}`);
        continue;
      }

      // Get the team_id from the database for this API team ID
      const [team] = await sql<{ id: number }[]>`
        SELECT id FROM teams WHERE name IN (
          SELECT DISTINCT home_team_name FROM afl_matches WHERE home_team_id = ${teamId}
          UNION
          SELECT DISTINCT away_team_name FROM afl_matches WHERE away_team_id = ${teamId}
        ) LIMIT 1
      `;

      if (!team) {
        console.log(`Team ${teamId} not found in database, skipping players`);
        continue;
      }

      // Upsert each player
      for (const player of players) {
        try {
          await sql`
            INSERT INTO afl_players (api_id, name, team_id)
            VALUES (${player.id}, ${player.name}, ${team.id})
            ON CONFLICT (api_id) DO UPDATE SET 
              name = EXCLUDED.name,
              updated_at = CURRENT_TIMESTAMP
          `;
          synced++;
        } catch (err) {
          console.error(`Error syncing player ${player.name}:`, err);
          errors++;
        }
      }
    } catch (err) {
      console.error(`Failed to fetch players for team ${teamId}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`AFL players sync complete — synced: ${synced}, errors: ${errors}`);
  return { synced, errors };
}

/**
 * Sync a single live fixture via individual API calls.
 * Fetches game events (goal scorers) and current match state (live scores).
 * Records score in afl_match_scores for worm visualization.
 */
export async function syncLiveFixture(gameId: number): Promise<void> {
  try {
    // Fetch game events (goal scorers)
    const eventsResponse = await axios.get<{ response: Array<{ id: number; player: { id: number; name: string }; type: string }> }>(
      `${API_SPORTS_BASE_URL}/games/events`,
      {
        params: { id: gameId },
        headers: { 'x-apisports-key': API_SPORTS_KEY },
        timeout: 10000,
      },
    );

    const events = eventsResponse.data?.response || [];

    // Fetch game state and live scores
    const gameResponse = await axios.get<{ response: { id: number; scores: { home: { score: number; goals: number; behinds: number }; away: { score: number; goals: number; behinds: number } } } }>(
      `${API_SPORTS_BASE_URL}/games`,
      {
        params: { id: gameId },
        headers: { 'x-apisports-key': API_SPORTS_KEY },
        timeout: 10000,
      },
    );

    const gameData = gameResponse.data?.response;
    if (!gameData) {
      console.error(`No game data returned for game ${gameId}`);
      return;
    }

    const homeScore = gameData.scores?.home?.score ?? 0;
    const awayScore = gameData.scores?.away?.score ?? 0;

    // Find the match in the database
    const [match] = await sql<{ id: number }[]>`
      SELECT id FROM afl_matches WHERE id = ${gameId} LIMIT 1
    `;

    if (!match) {
      console.error(`Match ${gameId} not found in database`);
      return;
    }

    // Update afl_matches with live scores
    const homeScoreJson = formatAflScore(
      homeScore,
      gameData.scores?.home?.goals ?? 0,
      gameData.scores?.home?.behinds ?? 0,
    );
    const awayScoreJson = formatAflScore(
      awayScore,
      gameData.scores?.away?.goals ?? 0,
      gameData.scores?.away?.behinds ?? 0,
    );

    await sql`
      UPDATE afl_matches
      SET 
        home_score = ${homeScoreJson},
        away_score = ${awayScoreJson},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${match.id}
    `;

    // Record score for worm visualization (every minute)
    await sql`
      INSERT INTO afl_match_scores (match_id, timestamp, home_score, away_score)
      VALUES (${match.id}, NOW(), ${homeScore}, ${awayScore})
    `;

    // Process goal events
    for (const event of events) {
      if (event.type === 'goal' || event.type === 'behind') {
        try {
          const [player] = await sql<{ id: number }[]>`
            SELECT id FROM afl_players WHERE api_id = ${event.player.id} LIMIT 1
          `;

          if (player) {
            await sql`
              INSERT INTO afl_match_events (match_id, player_id, event_type, timestamp)
              VALUES (${match.id}, ${player.id}, ${event.type}, ${event.id ?? null})
              ON CONFLICT DO NOTHING
            `;
          }
        } catch (err) {
          console.error(`Error storing event for player ${event.player.name}:`, err);
        }
      }
    }

    console.log(`Live fixture ${gameId} synced: ${homeScore}-${awayScore}`);
  } catch (err) {
    console.error(`Failed to sync live fixture ${gameId}:`, err instanceof Error ? err.message : err);
  }
}
