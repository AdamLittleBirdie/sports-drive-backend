import { Link } from 'react-router-dom';
import { getMatches } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Badge } from '../components/Badge';
import type { MatchWithTeams } from '../types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBC';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MatchCard({ match }: { match: MatchWithTeams }) {
  const isCompleted = match.status === 'completed';
  const homeWon =
    isCompleted &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.home_score > match.away_score;
  const awayWon =
    isCompleted &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.away_score > match.home_score;

  return (
    <Link to={`/matches/${match.id}`} style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.round}>{match.round}</span>
        <Badge label={match.status} variant={match.status} />
      </div>

      <div style={styles.teams}>
        <div style={{ ...styles.teamSide, textAlign: 'right' }}>
          <span style={{ ...styles.teamName, fontWeight: homeWon ? 700 : 400 }}>
            {match.home_team?.name ?? `Team ${match.home_team_id}`}
          </span>
          <span style={styles.abbr}>
            {match.home_team?.abbreviation ?? '—'}
          </span>
        </div>

        <div style={styles.scoreBox}>
          {isCompleted ? (
            <span style={styles.score}>
              <span style={{ color: homeWon ? '#e6edf3' : '#8b949e' }}>
                {match.home_score ?? '—'}
              </span>
              <span style={styles.scoreDivider}>–</span>
              <span style={{ color: awayWon ? '#e6edf3' : '#8b949e' }}>
                {match.away_score ?? '—'}
              </span>
            </span>
          ) : (
            <span style={styles.vs}>vs</span>
          )}
        </div>

        <div style={styles.teamSide}>
          <span style={{ ...styles.teamName, fontWeight: awayWon ? 700 : 400 }}>
            {match.away_team?.name ?? `Team ${match.away_team_id}`}
          </span>
          <span style={styles.abbr}>
            {match.away_team?.abbreviation ?? '—'}
          </span>
        </div>
      </div>

      <div style={styles.cardFooter}>
        <span style={styles.date}>{formatDate(match.date)}</span>
        <span style={styles.viewLink}>View stats →</span>
      </div>
    </Link>
  );
}

export function MatchesScreen() {
  const { data: matches, loading, error, refetch } = useFetch(getMatches);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!matches || matches.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No matches found. Check back soon.</p>
      </div>
    );
  }

  // Group by round
  const byRound = matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    (acc[m.round] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Matches</h1>
      {Object.entries(byRound).map(([round, roundMatches]) => (
        <section key={round} style={styles.section}>
          <h2 style={styles.roundHeading}>{round}</h2>
          <div style={styles.grid}>
            {roundMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  heading: { fontSize: 28, fontWeight: 700, marginBottom: 32, color: '#e6edf3' },
  section: { marginBottom: 40 },
  roundHeading: {
    fontSize: 14,
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #21262d',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'block',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 10,
    padding: '16px 20px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s, transform 0.1s',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  round: { fontSize: 13, color: '#8b949e', fontWeight: 500 },
  teams: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  teamSide: { display: 'flex', flexDirection: 'column', gap: 2 },
  teamName: { fontSize: 15, color: '#e6edf3', lineHeight: 1.3 },
  abbr: { fontSize: 12, color: '#8b949e' },
  scoreBox: { textAlign: 'center' },
  score: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' },
  scoreDivider: { color: '#30363d', margin: '0 4px' },
  vs: { fontSize: 14, color: '#8b949e', fontWeight: 500 },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { fontSize: 12, color: '#8b949e' },
  viewLink: { fontSize: 12, color: '#58a6ff' },
  empty: {
    textAlign: 'center',
    padding: '64px 24px',
    color: '#8b949e',
    fontSize: 15,
  },
};
