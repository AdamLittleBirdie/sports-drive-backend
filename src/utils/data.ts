/**
 * Pure utility functions for data transformation.
 * All functions are stateless and side-effect free.
 */

/**
 * Map API status codes to internal match status.
 * Works for both API-Sports and API-Football status codes.
 */
export function getMatchStatus(
  shortCode: string,
): 'scheduled' | 'in_progress' | 'completed' {
  if (['FT', 'AET', 'PEN'].includes(shortCode)) return 'completed';
  if (['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(shortCode))
    return 'in_progress';
  return 'scheduled';
}

/**
 * Generate a 3-letter abbreviation from a team name.
 * e.g. "Greater Western Sydney" → "GWS", "Richmond" → "RIC"
 */
export function generateTeamAbbreviation(name: string): string {
  const knownAbbreviations: Record<string, string> = {
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

  if (knownAbbreviations[name]) return knownAbbreviations[name];

  // Fallback: first letter of each word, up to 3 chars
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

/**
 * Format AFL scores as a JSON object.
 * Always include points, goals, behinds.
 */
export function formatAflScore(
  points: number | null,
  goals: number | null,
  behinds: number | null,
): string {
  return JSON.stringify({
    points: points ?? 0,
    goals: goals ?? 0,
    behinds: behinds ?? 0,
  });
}

/**
 * Format World Cup scores with all possible components.
 * Includes regular time, extra time, and penalty shootout.
 */
export function formatWorldCupScore(
  regularHome: number | null,
  regularAway: number | null,
  extraHome: number | null,
  extraAway: number | null,
  penaltyHome: number | null,
  penaltyAway: number | null,
): string {
  return JSON.stringify({
    regular: { home: regularHome ?? null, away: regularAway ?? null },
    extra: { home: extraHome ?? null, away: extraAway ?? null },
    penalty: { home: penaltyHome ?? null, away: penaltyAway ?? null },
  });
}

/**
 * Normalize a round string.
 * e.g. "Round - 5" → "Round 5", "16-Final" → "16-Final"
 */
export function normalizeRound(raw: string): string {
  if (!raw) return 'Unknown';
  return raw.replace(/^Round\s*-\s*/i, 'Round ').trim();
}

/**
 * Validate a date string and return as Date or null.
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? d : null;
}
