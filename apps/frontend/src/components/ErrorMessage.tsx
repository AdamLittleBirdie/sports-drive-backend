interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}>⚠️</span>
      <p style={styles.text}>{message}</p>
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
    gap: 12,
    padding: '64px 24px',
    textAlign: 'center',
  },
  icon: { fontSize: 32 },
  text: { color: '#f85149', fontSize: 15, maxWidth: 400 },
  button: {
    marginTop: 8,
    padding: '8px 20px',
    background: '#21262d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  },
};
