import React from 'react';
import { Link } from 'react-router-dom';
import { getTeams } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export function TeamsScreen() {
  const { data: teams, loading, error, refetch } = useFetch(getTeams);

  if (loading) return <LoadingSpinner message="Loading teams…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!teams || teams.length === 0) {
    return <p style={styles.empty}>No teams found.</p>;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>AFL Teams</h1>
      <div style={styles.grid}>
        {teams.map((team) => (
          <Link key={team.id} to={`/teams/${team.id}`} style={styles.card}>
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} style={styles.logo} />
            ) : (
              <div style={styles.logoPlaceholder}>{team.abbreviation}</div>
            )}
            <div style={styles.info}>
              <span style={styles.name}>{team.name}</span>
              <span style={styles.abbr}>{team.abbreviation}</span>
            </div>
            <span style={styles.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e3a5f',
    marginBottom: '1.5rem',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '0.85rem 1rem',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
    flexShrink: 0,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    background: '#1e3a5f',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  name: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#111827',
  },
  abbr: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    fontWeight: 500,
  },
  arrow: {
    color: '#9ca3af',
    fontSize: '1.1rem',
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '3rem',
  },
};
