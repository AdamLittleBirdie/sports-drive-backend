import { Link } from 'react-router-dom';
import { getTeams } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export function TeamsScreen() {
  const { data: teams, loading, error, refetch } = useFetch(getTeams);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!teams || teams.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No teams found. Check back soon.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Teams</h1>
      <div style={styles.grid}>
        {teams.map((team) => (
          <Link key={team.id} to={`/teams/${team.id}`} style={styles.card}>
            <div style={styles.logoWrapper}>
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} style={styles.logo} />
              ) : (
                <div style={styles.logoPlaceholder}>
                  <span style={styles.abbr}>{team.abbreviation}</span>
                </div>
              )}
            </div>
            <div style={styles.info}>
              <span style={styles.name}>{team.name}</span>
              <span style={styles.abbrSmall}>{team.abbreviation}</span>
            </div>
            <span style={styles.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  heading: { fontSize: 28, fontWeight: 700, marginBottom: 32, color: '#e6edf3' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 10,
    padding: '16px 20px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  logoWrapper: { flexShrink: 0 },
  logo: { width: 48, height: 48, objectFit: 'contain', borderRadius: 4 },
  logoPlaceholder: {
    width: 48,
    height: 48,
    background: '#21262d',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbr: { fontSize: 14, fontWeight: 700, color: '#58a6ff' },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  name: { fontSize: 16, fontWeight: 600, color: '#e6edf3' },
  abbrSmall: { fontSize: 12, color: '#8b949e' },
  arrow: { color: '#8b949e', fontSize: 16 },
  empty: {
    textAlign: 'center',
    padding: '64px 24px',
    color: '#8b949e',
    fontSize: 15,
  },
};
