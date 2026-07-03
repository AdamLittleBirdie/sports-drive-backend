import type {
  HealthResponse,
  MatchWithTeams,
  MatchDetail,
  Team,
  TeamWithPlayers,
  PlayerWithStats,
} from '../types';

const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'https://sports-drive-backend.up.railway.app';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed: ${res.status} ${res.statusText}`,
    );
  }
  const json = await res.json();
  // Backend wraps responses in { statusCode, data }
  if ('data' in json) {
    return json.data as T;
  }
  return json as T;
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
  return apiFetch<HealthResponse>('/health');
}
