export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  statusCode: number;
}

// ── AFL Domain Types ──────────────────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  logo_url: string | null;
}

export interface Player {
  id: number;
  name: string;
  team_id: number;
  position: string | null;
  number: number | null;
}

export interface Match {
  id: number;
  round: string;
  home_team_id: number;
  away_team_id: number;
  date: string | null;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'in_progress' | 'completed';
}

export interface MatchStat {
  id: number;
  match_id: number;
  player_id: number;
  disposals: number | null;
  marks: number | null;
  goals: number | null;
  behinds: number | null;
  tackles: number | null;
  kicks: number | null;
  handballs: number | null;
  hit_outs: number | null;
}

export interface MatchWithTeams extends Match {
  home_team: Team;
  away_team: Team;
}

export interface TeamWithPlayers extends Team {
  players: Player[];
}

export interface PlayerWithStats extends Player {
  stats: MatchStat[];
}

export interface SyncResult {
  synced: number;
  errors: number;
  message: string;
}
