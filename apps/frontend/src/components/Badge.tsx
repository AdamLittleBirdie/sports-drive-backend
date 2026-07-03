import React from 'react';

type MatchStatus = 'scheduled' | 'in_progress' | 'completed';

interface BadgeProps {
  status: MatchStatus;
}

const LABEL: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'Live',
  completed: 'Final',
};

const COLOR: Record<MatchStatus, { bg: string; text: string }> = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
  in_progress: { bg: '#dcfce7', text: '#15803d' },
  completed: { bg: '#f3f4f6', text: '#374151' },
};

export function Badge({ status }: BadgeProps) {
  const { bg, text } = COLOR[status] ?? COLOR.scheduled;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.6rem',
        borderRadius: 9999,
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: bg,
        color: text,
      }}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
