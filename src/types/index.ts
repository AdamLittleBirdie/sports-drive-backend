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

// ── Football Domain Types ─────────────────────────────────────────────────────

export interface FootballTeam {
  id: number;
  api_id: number;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  country: string | null;
  founded: number | null;
  created_at: string;
  updated_at: string;
}

export interface FootballMatch {
  id: number;
  api_id: number;
  league_id: number;
  league_name: string | null;
  season: number | null;
  round: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  date: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  venue: string | null;
  referee: string | null;
  created_at: string;
  updated_at: string;
}

export interface FootballMatchStat {
  id: number;
  match_id: number | null;
  team_id: number | null;
  shots_on_goal: number | null;
  shots_off_goal: number | null;
  total_shots: number | null;
  blocked_shots: number | null;
  fouls: number | null;
  corner_kicks: number | null;
  offsides: number | null;
  ball_possession: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  goalkeeper_saves: number | null;
  total_passes: number | null;
  passes_accurate: number | null;
  passes_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface FootballMatchWithTeams extends FootballMatch {
  home_team: FootballTeam | null;
  away_team: FootballTeam | null;
  stats?: FootballMatchStat[];
}

export interface FootballSyncResult {
  teams_synced: number;
  matches_synced: number;
  stats_synced: number;
  errors: number;
  message: string;
}

// ── Basketball Domain Types ───────────────────────────────────────────────────

export interface BasketballTeam {
  id: number;
  api_id: number;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  country: string | null;
  founded: number | null;
  created_at: string;
  updated_at: string;
}

export interface BasketballMatch {
  id: number;
  api_id: number;
  league_id: number;
  league_name: string | null;
  season: string | null;
  round: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  date: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  venue: string | null;
  created_at: string;
  updated_at: string;
}

export interface BasketballMatchStat {
  id: number;
  match_id: number | null;
  team_id: number | null;
  points: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  created_at: string;
  updated_at: string;
}

export interface BasketballMatchWithTeams extends BasketballMatch {
  home_team: BasketballTeam | null;
  away_team: BasketballTeam | null;
  stats?: BasketballMatchStat[];
}

export interface BasketballSyncResult {
  teams_synced: number;
  matches_synced: number;
  stats_synced: number;
  errors: number;
  message: string;
}

// ── Rugby Domain Types ────────────────────────────────────────────────────────

export interface RugbyTeam {
  id: number;
  api_id: number;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  country: string | null;
  founded: number | null;
  created_at: string;
  updated_at: string;
}

export interface RugbyMatch {
  id: number;
  api_id: number;
  league_id: number;
  league_name: string | null;
  season: number | null;
  round: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  date: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  venue: string | null;
  referee: string | null;
  created_at: string;
  updated_at: string;
}

export interface RugbyMatchStat {
  id: number;
  match_id: number | null;
  team_id: number | null;
  tries: number | null;
  goals: number | null;
  field_goals: number | null;
  tackles: number | null;
  offloads: number | null;
  passes: number | null;
  runs: number | null;
  line_breaks: number | null;
  errors: number | null;
  penalties: number | null;
  created_at: string;
  updated_at: string;
}

export interface RugbyMatchWithTeams extends RugbyMatch {
  home_team: RugbyTeam | null;
  away_team: RugbyTeam | null;
  stats?: RugbyMatchStat[];
}

export interface RugbySyncResult {
  teams_synced: number;
  matches_synced: number;
  stats_synced: number;
  errors: number;
  message: string;
}
