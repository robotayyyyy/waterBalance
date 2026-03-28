'use client';

import { useLang } from '../../i18n/LangContext';

type Model = '7days' | '6months';

export default function ModelToggle({ model, onChange }: { model: Model; onChange: (m: Model) => void }) {
  const { t } = useLang();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>{t.model.label}</span>
      {(['7days', '6months'] as Model[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, minHeight: 34,
            background: model === m ? '#3b82f6' : '#334155',
            color: model === m ? '#fff' : '#94a3b8',
          }}
        >{t.model[m]}</button>
      ))}
    </div>
  );
}
