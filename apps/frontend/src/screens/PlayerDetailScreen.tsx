import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { getPlayer } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { MatchStat } from '../types';

const STAT_COLS: { key: keyof MatchStat; label: string }[] = [
  { key: 'disposals', label: 'Disposals' },
  { key: 'kicks', label: 'Kicks' },
  { key: 'handballs', label: 'Handballs' },
  { key: 'marks', label: 'Marks' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'goals', label: 'Goals' },
  { key: 'behinds', label: 'Behinds' },
  { key: 'hit_outs', label: 'Hit Outs' },
];

function avg(stats: MatchStat[], key: keyof MatchStat): string {
  const vals = stats.map((s) => s[key]).filter((v): v is number => v !== null);
  if (vals.length === 0) return '—';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function total(stats: MatchStat[], key: keyof MatchStat): string {
  const vals = stats.map((s) => s[key]).filter((v): v is number => v !== null);
  if (vals.length === 0) return '—';
  return String(vals.reduce((a, b) => a + b, 0));
}

export function PlayerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data: player, loading, error, refetch } = useFetch(
    useMemo(() => () => getPlayer(id!), [id]),
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!player) return null;

  const hasStats = player.stats.length > 0;

  return (
    <div style={styles.page}>
      <Link to={`/teams/${player.team_id}`} style={styles.back}>← Team Roster</Link>

      {/* Player header */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          <span style={styles.avatarText}>
            {player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 style={styles.playerName}>{player.name}</h1>
          <div style={styles.metaRow}>
            {player.number !== null && (
              <span style={styles.metaChip}>#{player.number}</span>
            )}
            {player.position && (
              <span style={styles.metaChip}>{player.position}</span>
            )}
            <span style={styles.metaChip}>{player.stats.length} matches</span>
          </div>
        </div>
      </div>

      {/* Career averages */}
      {hasStats && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Career Averages</h2>
          <div style={styles.statsGrid}>
            {STAT_COLS.map((c) => (
              <div key={c.key} style={styles.statCard}>
                <span style={styles.statValue}>{avg(player.stats, c.key)}</span>
                <span style={styles.statLabel}>{c.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Career totals */}
      {hasStats && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Career Totals</h2>
          <div style={styles.statsGrid}>
            {STAT_COLS.map((c) => (
              <div key={c.key} style={styles.statCard}>
                <span style={styles.statValue}>{total(player.stats, c.key)}</span>
                <span style={styles.statLabel}>{c.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Match-by-match log */}
      {hasStats ? (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Match Log</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Match</th>
                  {STAT_COLS.map((c) => (
                    <th key={c.key} style={styles.th}>{c.label.slice(0, 4)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {player.stats.map((stat) => (
                  <tr key={stat.id} style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: 'left' }}>
                      <Link to={`/matches/${stat.match_id}`} style={styles.matchLink}>
                        Match #{stat.match_id}
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
          <p>No match statistics recorded for this player yet.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  back: { display: 'inline-block', color: '#58a6ff', textDecoration: 'none', fontSize: 14, marginBottom: 24 },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    background: 'linear-gradient(135deg, #1f6feb, #388bfd)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 24, fontWeight: 800, color: '#fff' },
  playerName: { fontSize: 26, fontWeight: 700, color: '#e6edf3', marginBottom: 8 },
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    padding: '3px 10px',
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 12,
    fontSize: 12,
    color: '#8b949e',
    fontWeight: 500,
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e6edf3',
    marginBottom: 16,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 24, fontWeight: 700, color: '#e6edf3' },
  statLabel: { fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
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
  tr: { borderBottom: '1px solid #21262d' },
  td: { padding: '10px 12px', textAlign: 'center', color: '#e6edf3' },
  matchLink: { color: '#58a6ff', textDecoration: 'none', fontWeight: 500 },
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
