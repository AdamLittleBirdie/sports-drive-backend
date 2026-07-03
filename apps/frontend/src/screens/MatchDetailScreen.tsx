import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { getMatch } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Badge } from '../components/Badge';
import type { MatchStat } from '../types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBC';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STAT_COLS: { key: keyof MatchStat; label: string }[] = [
  { key: 'disposals', label: 'Disp' },
  { key: 'kicks', label: 'Kicks' },
  { key: 'handballs', label: 'HB' },
  { key: 'marks', label: 'Marks' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'goals', label: 'Goals' },
  { key: 'behinds', label: 'Bhds' },
  { key: 'hit_outs', label: 'HO' },
];

export function MatchDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data: match, loading, error, refetch } = useFetch(
    useMemo(() => () => getMatch(id!), [id]),
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!match) return null;

  const homeWon =
    match.status === 'completed' &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.home_score > match.away_score;
  const awayWon =
    match.status === 'completed' &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.away_score > match.home_score;

  const homeStats = match.stats.filter(
    (s) => s.player_id !== undefined,
  );

  return (
    <div style={styles.page}>
      <Link to="/" style={styles.back}>← All Matches</Link>

      {/* Match header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <span style={styles.round}>{match.round}</span>
          <Badge label={match.status} variant={match.status} />
        </div>

        <div style={styles.scoreboard}>
          <div style={{ ...styles.teamBlock, textAlign: 'right' }}>
            <Link
              to={`/teams/${match.home_team_id}`}
              style={{ ...styles.teamName, fontWeight: homeWon ? 700 : 400 }}
            >
              {match.home_team?.name ?? `Team ${match.home_team_id}`}
            </Link>
            <span style={styles.teamAbbr}>{match.home_team?.abbreviation}</span>
          </div>

          <div style={styles.scoreCenter}>
            {match.status !== 'scheduled' ? (
              <>
                <span style={{ ...styles.scoreNum, color: homeWon ? '#e6edf3' : '#8b949e' }}>
                  {match.home_score ?? '—'}
                </span>
                <span style={styles.scoreSep}>–</span>
                <span style={{ ...styles.scoreNum, color: awayWon ? '#e6edf3' : '#8b949e' }}>
                  {match.away_score ?? '—'}
                </span>
              </>
            ) : (
              <span style={styles.vsText}>vs</span>
            )}
          </div>

          <div style={styles.teamBlock}>
            <Link
              to={`/teams/${match.away_team_id}`}
              style={{ ...styles.teamName, fontWeight: awayWon ? 700 : 400 }}
            >
              {match.away_team?.name ?? `Team ${match.away_team_id}`}
            </Link>
            <span style={styles.teamAbbr}>{match.away_team?.abbreviation}</span>
          </div>
        </div>

        <p style={styles.date}>{formatDate(match.date)}</p>
      </div>

      {/* Player stats table */}
      {homeStats.length > 0 ? (
        <section style={styles.statsSection}>
          <h2 style={styles.sectionTitle}>Player Statistics</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Player</th>
                  {STAT_COLS.map((c) => (
                    <th key={c.key} style={styles.th}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {homeStats.map((stat) => (
                  <tr key={stat.id} style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: 'left' }}>
                      <Link to={`/players/${stat.player_id}`} style={styles.playerLink}>
                        Player #{stat.player_id}
                      </Link>
                    </td>
                    {STAT_COLS.map((c) => (
                      <td key={c.key} style={styles.td}>
                        {stat[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div style={styles.noStats}>
          <p>No player statistics recorded for this match yet.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  back: { display: 'inline-block', color: '#58a6ff', textDecoration: 'none', fontSize: 14, marginBottom: 24 },
  header: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '24px 32px',
    marginBottom: 32,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  round: { fontSize: 13, color: '#8b949e', fontWeight: 500 },
  scoreboard: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  teamBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  teamName: {
    fontSize: 20,
    color: '#e6edf3',
    textDecoration: 'none',
    lineHeight: 1.3,
  },
  teamAbbr: { fontSize: 13, color: '#8b949e' },
  scoreCenter: { textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scoreNum: { fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' },
  scoreSep: { fontSize: 28, color: '#30363d' },
  vsText: { fontSize: 18, color: '#8b949e' },
  date: { fontSize: 13, color: '#8b949e', textAlign: 'center' },
  statsSection: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e6edf3',
    marginBottom: 16,
  },
  tableWrapper: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    padding: '10px 12px',
    textAlign: 'center',
    color: '#8b949e',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #30363d',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #21262d',
  },
  td: {
    padding: '10px 12px',
    textAlign: 'center',
    color: '#e6edf3',
  },
  playerLink: {
    color: '#58a6ff',
    textDecoration: 'none',
    fontWeight: 500,
  },
  noStats: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#8b949e',
    fontSize: 15,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 10,
  },
};
