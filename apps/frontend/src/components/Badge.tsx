type Variant = 'scheduled' | 'in_progress' | 'completed' | 'default';

interface Props {
  label: string;
  variant?: Variant;
}

const variantColors: Record<Variant, { bg: string; color: string }> = {
  scheduled: { bg: '#1f2937', color: '#9ca3af' },
  in_progress: { bg: '#1c3a2a', color: '#34d399' },
  completed: { bg: '#1e2a3a', color: '#58a6ff' },
  default: { bg: '#21262d', color: '#8b949e' },
};

export function Badge({ label, variant = 'default' }: Props) {
  const { bg, color } = variantColors[variant];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        background: bg,
        color,
      }}
    >
      {label.replace('_', ' ')}
    </span>
  );
}
