'use client';

import { useLang } from '../../i18n/LangContext';

type Mode = 'drought' | 'runoff' | 'waterbalance';

export default function ModeButtons({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useLang();

  const MODES: { value: Mode; label: string }[] = [
    { value: 'drought', label: t.mode.drought },
    { value: 'runoff', label: t.mode.runoff },
    { value: 'waterbalance', label: t.mode.waterbalance },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>{t.mode.label}</span>
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
