'use client';

type Model = '7days' | '6months';

export default function ModelToggle({ model, onChange }: { model: Model; onChange: (m: Model) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>Model:</span>
      {(['7days', '6months'] as Model[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: '4px 12px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            background: model === m ? '#3b82f6' : '#334155',
            color: model === m ? '#fff' : '#94a3b8',
          }}
        >{m === '7days' ? '7-Day' : '6-Month'}</button>
      ))}
    </div>
  );
}
