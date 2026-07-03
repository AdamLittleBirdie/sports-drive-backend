import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Matches' },
  { to: '/teams', label: 'Teams' },
];

export function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>
        🏉 Sports Drive
      </Link>
      <div style={styles.links}>
        {NAV_LINKS.map(({ to, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{ ...styles.link, ...(active ? styles.linkActive : {}) }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: 56,
    background: '#1e3a5f',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  },
  brand: {
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.1rem',
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
  },
  link: {
    color: '#cbd5e1',
    textDecoration: 'none',
    padding: '0.35rem 0.85rem',
    borderRadius: 6,
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  linkActive: {
    color: '#fff',
    background: 'rgba(255,255,255,0.15)',
  },
};
