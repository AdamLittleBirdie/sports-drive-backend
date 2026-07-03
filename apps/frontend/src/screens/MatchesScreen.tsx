import React from 'react';
import { Link } from 'react-router-dom';
import { getMatches } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Badge } from '../components/Badge';
import type { MatchWithTeams } from '../types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBC';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByRound(matches: MatchWithTeams[]): Map<string, MatchWithTeams[]> {
  const map = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const group = map.get(m.round) ?? [];
    group.push(m);
    map.set(m.round, group);
  }
  return map;
}

export function MatchesScreen() {
  const { data: matches, loading, error, refetch } = useFetch(getMatches);

  if (loading) return <LoadingSpinner message="Loading matches…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!matches || matches.length === 0) {
    return <p style={styles.empty}>No matches found.</p>;
  }

  const grouped = groupByRound(matches);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>AFL Matches</h1>
      {Array.from(grouped.entries()).map(([round, roundMatches]) => (
        <section key={round} style={styles.section}>
          <h2 style={styles.roundHeading}>{round}</h2>
          <div style={styles.grid}>
            {roundMatches.map((match) => (
              <Link key={match.id} to={`/matches/${match.id}`} style={styles.card}>
                <div style={styles.cardHeader}>
                  <Badge status={match.status} />
                  <span style={styles.date}>{formatDate(match.date)}</span>
                </div>
                <div style={styles.teams}>
                  <div style={styles.teamBlock}>
                    <span style={styles.teamName}>{match.home_team?.name ?? '—'}</span>
                    {match.status !== 'scheduled' && (
                      <span style={styles.score}>{match.home_score ?? '—'}</span>
                    )}
                  </div>
                  <span style={styles.vs}>vs</span>
                  <div style={styles.teamBlock}>
                    <span style={styles.teamName}>{match.away_team?.name ?? '—'}</span>
                    {match.status !== 'scheduled' && (
                      <span style={styles.score}>{match.away_score ?? '—'}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e3a5f',
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '2rem',
  },
  roundHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.75rem',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '0.4rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    display: 'block',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '1rem',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  date: {
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  teams: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  teamBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  teamName: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#111827',
  },
  score: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#1e3a5f',
  },
  vs: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontWeight: 600,
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '3rem',
  },
};
