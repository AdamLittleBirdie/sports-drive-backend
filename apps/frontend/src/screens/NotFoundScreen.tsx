import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundScreen() {
  return (
    <div style={styles.page}>
      <span style={styles.code}>404</span>
      <h1 style={styles.heading}>Page not found</h1>
      <p style={styles.body}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" style={styles.link}>← Back to Matches</Link>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: '2rem',
    textAlign: 'center',
  },
  code: {
    fontSize: '5rem',
    fontWeight: 900,
    color: '#e5e7eb',
    lineHeight: 1,
    marginBottom: '0.5rem',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e3a5f',
    margin: '0 0 0.75rem',
  },
  body: {
    color: '#6b7280',
    fontSize: '0.95rem',
    marginBottom: '1.5rem',
    maxWidth: 360,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
};
