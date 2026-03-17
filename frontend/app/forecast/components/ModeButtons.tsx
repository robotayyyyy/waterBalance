'use client';

type Mode = 'drought' | 'runoff' | 'waterbalance';

const MODES: { value: Mode; label: string }[] = [
  { value: 'drought', label: 'Drought' },
  { value: 'runoff', label: 'Runoff' },
  { value: 'waterbalance', label: 'Water Balance' },
];

export default function ModeButtons({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>Mode:</span>
      {MODES.map(m => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, minHeight: 34,
            background: mode === m.value ? '#3b82f6' : '#334155',
            color: mode === m.value ? '#fff' : '#94a3b8',
          }}
        >{m.label}</button>
      ))}
    </div>
  );
}
