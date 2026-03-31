'use client';

import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

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
      <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{t.mode.label}</span>
      {MODES.map(m => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          style={{
            padding: `${theme.button.paddingY}px ${theme.button.paddingX}px`,
            border: 'none', borderRadius: theme.radius.md, cursor: 'pointer',
            fontSize: theme.fontSize.sm, minHeight: theme.button.height,
            background: mode === m.value ? theme.color.primary : theme.color.darkBtnBg,
            color: mode === m.value ? theme.color.textOnDark : theme.color.textMuted,
          }}
        >{m.label}</button>
      ))}
    </div>
  );
}
