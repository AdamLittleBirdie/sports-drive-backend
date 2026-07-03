import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { getTeam } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data: team, loading, error, refetch } = useFetch(
    useMemo(() => () => getTeam(id!), [id]),
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!team) return null;

  const byPosition = team.players.reduce<Record<string, typeof team.players>>(
    (acc, p) => {
      const pos = p.position ?? 'Unknown';
      (acc[pos] ??= []).push(p);
      return acc;
    },
    {},
  );

  const positionOrder = ['Forward', 'Midfielder', 'Defender', 'Ruck', 'Unknown'];
  const sortedPositions = Object.keys(byPosition).sort(
    (a, b) =>
      (positionOrder.indexOf(a) === -1 ? 99 : positionOrder.indexOf(a)) -
      (positionOrder.indexOf(b) === -1 ? 99 : positionOrder.indexOf(b)),
  );

  return (
    <div style={styles.page}>
      <Link to="/teams" style={styles.back}>← All Teams</Link>

      {/* Team header */}
      <div style={styles.header}>
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} style={styles.logo} />
        ) : (
          <div style={styles.logoPlaceholder}>
            <span style={styles.abbr}>{team.abbreviation}</span>
          </div>
        )}
        <div>
          <h1 style={styles.teamName}>{team.name}</h1>
          <p style={styles.meta}>
            {team.abbreviation} · {team.players.length} players
          </p>
        </div>
      </div>

      {/* Roster */}
      {team.players.length === 0 ? (
        <div style={styles.empty}>
          <p>No players on roster yet.</p>
        </div>
      ) : (
        sortedPositions.map((pos) => (
          <section key={pos} style={styles.section}>
            <h2 style={styles.posHeading}>{pos}s</h2>
            <div style={styles.playerGrid}>
              {byPosition[pos].map((player) => (
                <Link key={player.id} to={`/players/${player.id}`} style={styles.playerCard}>
                  <div style={styles.numberBadge}>
                    #{player.number ?? '—'}
                  </div>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>{player.name}</span>
                    <span style={styles.playerPos}>{player.position ?? 'Unknown'}</span>
                  </div>
                  <span style={styles.arrow}>→</span>
                </Link>
              ))}
            </div>
          </section>
        ))
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
  logo: { width: 72, height: 72, objectFit: 'contain', borderRadius: 8 },
  logoPlaceholder: {
    width: 72,
    height: 72,
    background: '#21262d',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  abbr: { fontSize: 20, fontWeight: 800, color: '#58a6ff' },
  teamName: { fontSize: 26, fontWeight: 700, color: '#e6edf3', marginBottom: 4 },
  meta: { fontSize: 14, color: '#8b949e' },
  section: { marginBottom: 32 },
  posHeading: {
    fontSize: 13,
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid #21262d',
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 8,
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '12px 16px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  numberBadge: {
    width: 36,
    height: 36,
    background: '#21262d',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#58a6ff',
    flexShrink: 0,
  },
  playerInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  playerName: { fontSize: 14, fontWeight: 600, color: '#e6edf3' },
  playerPos: { fontSize: 12, color: '#8b949e' },
  arrow: { color: '#8b949e', fontSize: 14 },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#8b949e',
    fontSize: 15,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 10,
  },
};
