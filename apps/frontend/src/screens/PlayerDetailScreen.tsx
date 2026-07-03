import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayer } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { MatchStat } from '../types';

type StatKey = keyof Omit<MatchStat, 'id' | 'match_id' | 'player_id'>;

const STAT_COLS: { key: StatKey; label: string }[] = [
  { key: 'disposals', label: 'Disposals' },
  { key: 'kicks', label: 'Kicks' },
  { key: 'handballs', label: 'Handballs' },
  { key: 'marks', label: 'Marks' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'goals', label: 'Goals' },
  { key: 'behinds', label: 'Behinds' },
  { key: 'hit_outs', label: 'Hit Outs' },
];

function avg(stats: MatchStat[], key: StatKey): string {
  const values = stats.map((s) => s[key]).filter((v): v is number => v != null);
  if (values.length === 0) return '—';
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function total(stats: MatchStat[], key: StatKey): string {
  const values = stats.map((s) => s[key]).filter((v): v is number => v != null);
  if (values.length === 0) return '—';
  return String(values.reduce((a, b) => a + b, 0));
}

export function PlayerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => getPlayer(id!), [id]);
  const { data: player, loading, error, refetch } = useFetch(fetcher);

  if (loading) return <LoadingSpinner message="Loading player…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!player) return null;

  const gamesPlayed = player.stats.length;

  return (
    <div style={styles.page}>
      <Link to={`/teams/${player.team_id}`} style={styles.back}>← Back to Team</Link>

      {/* Player header */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          {player.number != null ? `#${player.number}` : '?'}
        </div>
        <div>
          <h1 style={styles.name}>{player.name}</h1>
          <div style={styles.meta}>
            {player.position && <span style={styles.tag}>{player.position}</span>}
            <span style={styles.games}>{gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Career summary cards */}
      {gamesPlayed > 0 && (
        <>
          <h2 style={styles.sectionHeading}>Career Averages</h2>
          <div style={styles.summaryGrid}>
            {STAT_COLS.map((col) => (
              <div key={col.key} style={styles.summaryCard}>
                <span style={styles.summaryValue}>{avg(player.stats, col.key)}</span>
                <span style={styles.summaryLabel}>{col.label}</span>
              </div>
            ))}
          </div>

          <h2 style={styles.sectionHeading}>Career Totals</h2>
          <div style={styles.summaryGrid}>
            {STAT_COLS.map((col) => (
              <div key={col.key} style={styles.summaryCard}>
                <span style={styles.summaryValue}>{total(player.stats, col.key)}</span>
                <span style={styles.summaryLabel}>{col.label}</span>
              </div>
            ))}
          </div>

          {/* Per-game breakdown */}
          <h2 style={styles.sectionHeading}>Game-by-Game Stats</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Match</th>
                  {STAT_COLS.map((col) => (
                    <th key={col.key} style={styles.th}>{col.label.slice(0, 4)}</th>
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
                    {STAT_COLS.map((col) => (
                      <td key={col.key} style={styles.td}>
                        {stat[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {gamesPlayed === 0 && (
        <p style={styles.noStats}>No stats recorded for this player yet.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  back: {
    display: 'inline-block',
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '0.9rem',
    marginBottom: '1.25rem',
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#1e3a5f',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.1rem',
    flexShrink: 0,
  },
  name: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e3a5f',
    margin: '0 0 0.4rem',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  tag: {
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: 9999,
    padding: '0.2rem 0.65rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  games: {
    color: '#9ca3af',
    fontSize: '0.85rem',
  },
  sectionHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '0.75rem',
    marginTop: '1.5rem',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  summaryCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '0.75rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1e3a5f',
  },
  summaryLabel: {
    fontSize: '0.7rem',
    color: '#9ca3af',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    marginTop: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    background: '#f9fafb',
    padding: '0.6rem 0.75rem',
    fontWeight: 700,
    color: '#374151',
    textAlign: 'center',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '0.55rem 0.75rem',
    color: '#374151',
    textAlign: 'center',
  },
  matchLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
  },
  noStats: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '2rem',
  },
};
