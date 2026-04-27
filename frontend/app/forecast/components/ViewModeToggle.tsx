'use client';

import { theme } from '../theme';
import { useLang } from '../../i18n/LangContext';

export type ViewMode = 'admin' | 'basin';

export default function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useLang();
  const btn = (m: ViewMode, label: string) => (
    <button
      onClick={() => onChange(m)}
      style={{
        padding: `${theme.button.paddingY}px ${theme.button.paddingX}px`,
        border: 'none', borderRadius: theme.radius.md, cursor: 'pointer',
        fontSize: theme.fontSize.sm, minHeight: theme.button.height,
        background: mode === m ? theme.color.primary : theme.color.darkBtnBg,
        color: mode === m ? theme.color.textOnDark : theme.color.textMuted,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {btn('admin', t.viewMode.admin)}
      {btn('basin', t.viewMode.basin)}
    </div>
  );
}
