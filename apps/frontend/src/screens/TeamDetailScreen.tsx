import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTeam } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { Player } from '../types';

function groupByPosition(players: Player[]): Map<string, Player[]> {
  const map = new Map<string, Player[]>();
  for (const p of players) {
    const pos = p.position ?? 'Unknown';
    const group = map.get(pos) ?? [];
    group.push(p);
    map.set(pos, group);
  }
  // Sort positions alphabetically, Unknown last
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    }),
  );
}

export function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => getTeam(id!), [id]);
  const { data: team, loading, error, refetch } = useFetch(fetcher);

  if (loading) return <LoadingSpinner message="Loading team…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!team) return null;

  const grouped = groupByPosition(team.players);

  return (
    <div style={styles.page}>
      <Link to="/teams" style={styles.back}>← All Teams</Link>

      <div style={styles.header}>
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} style={styles.logo} />
        ) : (
          <div style={styles.logoPlaceholder}>{team.abbreviation}</div>
        )}
        <div>
          <h1 style={styles.heading}>{team.name}</h1>
          <span style={styles.abbr}>{team.abbreviation}</span>
        </div>
      </div>

      <h2 style={styles.rosterHeading}>
        Roster <span style={styles.count}>({team.players.length} players)</span>
      </h2>

      {team.players.length === 0 && (
        <p style={styles.empty}>No players on roster.</p>
      )}

      {Array.from(grouped.entries()).map(([position, players]) => (
        <section key={position} style={styles.section}>
          <h3 style={styles.positionHeading}>{position}</h3>
          <div style={styles.playerGrid}>
            {players.map((player) => (
              <Link key={player.id} to={`/players/${player.id}`} style={styles.playerCard}>
                <span style={styles.number}>
                  {player.number != null ? `#${player.number}` : '—'}
                </span>
                <span style={styles.playerName}>{player.name}</span>
                <span style={styles.arrow}>→</span>
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
    maxWidth: 800,
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
  logo: {
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    background: '#1e3a5f',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1rem',
    flexShrink: 0,
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e3a5f',
    margin: 0,
  },
  abbr: {
    fontSize: '0.9rem',
    color: '#9ca3af',
    fontWeight: 600,
  },
  rosterHeading: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '1rem',
  },
  count: {
    fontWeight: 400,
    color: '#9ca3af',
    fontSize: '0.95rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  positionHeading: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '0.3rem',
  },
  playerGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.85rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background 0.12s',
  },
  number: {
    width: 36,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#9ca3af',
    flexShrink: 0,
  },
  playerName: {
    flex: 1,
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#111827',
  },
  arrow: {
    color: '#d1d5db',
    fontSize: '0.9rem',
  },
  empty: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '2rem',
  },
};
