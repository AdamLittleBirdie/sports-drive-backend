import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  const fetcher = useCallback(() => getMatch(id!), [id]);
  const { data: match, loading, error, refetch } = useFetch(fetcher);

  if (loading) return <LoadingSpinner message="Loading match…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!match) return null;

  const homeStats = match.stats.filter((s) => {
    // We don't have team_id on MatchStat directly; show all stats in one table
    return s;
  });

  return (
    <div style={styles.page}>
      <Link to="/" style={styles.back}>← All Matches</Link>

      <div style={styles.header}>
        <div style={styles.headerMeta}>
          <span style={styles.round}>{match.round}</span>
          <Badge status={match.status} />
        </div>
        <p style={styles.date}>{formatDate(match.date)}</p>
      </div>

      {/* Scoreboard */}
      <div style={styles.scoreboard}>
        <div style={styles.teamScore}>
          <Link to={`/teams/${match.home_team_id}`} style={styles.teamLink}>
            {match.home_team?.name ?? '—'}
          </Link>
          {match.status !== 'scheduled' && (
            <span style={styles.bigScore}>{match.home_score ?? '—'}</span>
          )}
        </div>
        <span style={styles.scoreVs}>vs</span>
        <div style={{ ...styles.teamScore, alignItems: 'flex-end' }}>
          <Link to={`/teams/${match.away_team_id}`} style={styles.teamLink}>
            {match.away_team?.name ?? '—'}
          </Link>
          {match.status !== 'scheduled' && (
            <span style={styles.bigScore}>{match.away_score ?? '—'}</span>
          )}
        </div>
      </div>

      {/* Player Stats */}
      {homeStats.length > 0 && (
        <section style={styles.statsSection}>
          <h2 style={styles.sectionHeading}>Player Stats</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Player ID</th>
                  {STAT_COLS.map((col) => (
                    <th key={col.key} style={styles.th}>{col.label}</th>
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
        </section>
      )}

      {homeStats.length === 0 && match.status === 'scheduled' && (
        <p style={styles.noStats}>Stats will be available once the match is played.</p>
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
    marginBottom: '1.5rem',
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.4rem',
  },
  round: {
    fontWeight: 700,
    color: '#6b7280',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  date: {
    color: '#9ca3af',
    fontSize: '0.9rem',
    margin: 0,
  },
  scoreboard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1e3a5f',
    borderRadius: 12,
    padding: '1.5rem 2rem',
    marginBottom: '2rem',
    color: '#fff',
  },
  teamScore: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    flex: 1,
  },
  teamLink: {
    color: '#93c5fd',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  bigScore: {
    fontSize: '3rem',
    fontWeight: 900,
    lineHeight: 1,
    color: '#fff',
  },
  scoreVs: {
    color: '#64748b',
    fontWeight: 700,
    fontSize: '1rem',
    padding: '0 1rem',
  },
  statsSection: {
    marginTop: '1rem',
  },
  sectionHeading: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1e3a5f',
    marginBottom: '0.75rem',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
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
  playerLink: {
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
