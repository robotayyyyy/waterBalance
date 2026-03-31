'use client';

import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

type Model = '7days' | '6months';

export default function ModelToggle({ model, onChange }: { model: Model; onChange: (m: Model) => void }) {
  const { t } = useLang();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{t.model.label}</span>
      {(['7days', '6months'] as Model[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: `${theme.button.paddingY}px ${theme.button.paddingX}px`,
            border: 'none', borderRadius: theme.radius.md, cursor: 'pointer',
            fontSize: theme.fontSize.sm, minHeight: theme.button.height,
            background: model === m ? theme.color.primary : theme.color.darkBtnBg,
            color: model === m ? theme.color.textOnDark : theme.color.textMuted,
          }}
        >{t.model[m]}</button>
      ))}
    </div>
  );
}
