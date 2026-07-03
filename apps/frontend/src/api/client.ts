import type {
  ApiResponse,
  HealthResponse,
  MatchWithTeams,
  MatchDetail,
  Team,
  TeamWithPlayers,
  PlayerWithStats,
} from '../types';

const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  'https://sports-drive-backend.up.railway.app';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (json.error) throw new Error(json.error);
  if (json.data === undefined) throw new Error('Empty response from server');
  return json.data;
}

/** Fetch all matches (with home/away team info). */
export function getMatches(): Promise<MatchWithTeams[]> {
  return apiFetch<MatchWithTeams[]>('/api/matches');
}

/** Fetch a single match with team info and player stats. */
export function getMatch(id: number | string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/api/matches/${id}`);
}

/** Fetch all teams. */
export function getTeams(): Promise<Team[]> {
  return apiFetch<Team[]>('/api/teams');
}

/** Fetch a single team with its full player roster. */
export function getTeam(id: number | string): Promise<TeamWithPlayers> {
  return apiFetch<TeamWithPlayers>(`/api/teams/${id}`);
}

/** Fetch a single player with all their match stats. */
export function getPlayer(id: number | string): Promise<PlayerWithStats> {
  return apiFetch<PlayerWithStats>(`/api/players/${id}`);
}

/** Health check. */
export function getHealth(): Promise<HealthResponse> {
  return fetch(`${BASE_URL}/health`)
    .then((r) => r.json() as Promise<HealthResponse>);
}
