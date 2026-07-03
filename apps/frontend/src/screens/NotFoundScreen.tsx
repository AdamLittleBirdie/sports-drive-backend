import { Link } from 'react-router-dom';

export function NotFoundScreen() {
  return (
    <div style={styles.wrapper}>
      <span style={styles.code}>404</span>
      <h1 style={styles.title}>Page not found</h1>
      <p style={styles.sub}>The page you're looking for doesn't exist.</p>
      <Link to="/" style={styles.link}>← Back to Matches</Link>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 12,
    textAlign: 'center',
    padding: '0 24px',
  },
  code: { fontSize: 72, fontWeight: 800, color: '#21262d', lineHeight: 1 },
  title: { fontSize: 24, fontWeight: 700, color: '#e6edf3' },
  sub: { fontSize: 15, color: '#8b949e', marginBottom: 8 },
  link: { color: '#58a6ff', textDecoration: 'none', fontSize: 14 },
};
