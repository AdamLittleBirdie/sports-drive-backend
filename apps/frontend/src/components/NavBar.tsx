import { Link, useLocation } from 'react-router-dom';

const links = [
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
        {links.map(({ to, label }) => {
          const active =
            to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{ ...styles.link, ...(active ? styles.activeLink : {}) }}
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
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '0 24px',
    height: 56,
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    fontWeight: 700,
    fontSize: 18,
    color: '#e6edf3',
    textDecoration: 'none',
    marginRight: 'auto',
  },
  links: { display: 'flex', gap: 4 },
  link: {
    padding: '6px 14px',
    borderRadius: 6,
    color: '#8b949e',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  activeLink: {
    color: '#e6edf3',
    background: '#21262d',
  },
};
