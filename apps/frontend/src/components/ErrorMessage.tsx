import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}>⚠️</span>
      <p style={styles.message}>{message}</p>
      {onRetry && (
        <button style={styles.button} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    gap: '0.75rem',
    textAlign: 'center',
  },
  icon: {
    fontSize: '2rem',
  },
  message: {
    color: '#dc2626',
    fontSize: '0.95rem',
    margin: 0,
    maxWidth: 400,
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.5rem 1.25rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
};
