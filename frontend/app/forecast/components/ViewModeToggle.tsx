'use client';

export type ViewMode = 'admin' | 'basin';

export default function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const btn = (m: ViewMode, label: string) => (
    <button
      onClick={() => onChange(m)}
      style={{
        padding: '4px 12px',
        border: '1px solid',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        background: mode === m ? '#0ea5e9' : 'transparent',
        color: mode === m ? '#fff' : '#94a3b8',
        borderColor: mode === m ? '#0ea5e9' : '#475569',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {btn('admin', 'Admin')}
      {btn('basin', 'Basin')}
    </div>
  );
}
