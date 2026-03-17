'use client';

import { useState, useEffect } from 'react';

type Mode = 'drought' | 'runoff' | 'waterbalance';

const DROUGHT_SCALE = [
  { value: 0, label: 'Normal', color: '#ffffff' },
  { value: 1, label: 'Watch', color: '#feff73' },
  { value: 2, label: 'Warning', color: '#ffaa01' },
  { value: 3, label: 'Critical', color: '#fe0000' },
];

const RUNOFF_SCALE = [
  { value: 0, label: 'Normal', color: '#ffffff' },
  { value: 1, label: 'Low', color: '#bee8ff' },
  { value: 2, label: 'High', color: '#01c5ff' },
  { value: 3, label: 'Extreme', color: '#005be7' },
];

const WATERBALANCE_SCALE = [
  { label: 'Surplus (≥ 0)', color: '#2563eb' },
  { label: 'Deficit (< 0)', color: '#dc2626' },
];

const MODE_TITLES: Record<Mode, string> = {
  drought: 'Drought Index',
  runoff: 'Runoff Index',
  waterbalance: 'Water Balance',
};

export default function Legend({ mode }: { mode: Mode }) {
  const items = mode === 'drought' ? DROUGHT_SCALE : mode === 'runoff' ? RUNOFF_SCALE : WATERBALANCE_SCALE;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, []);

  const allDots = [...items, { color: '#cccccc' }];

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      background: '#fff', borderRadius: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,.15)', zIndex: 10,
      overflow: 'hidden',
    }}>
      {/* Collapsed: dot strip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 8px', border: 'none', background: 'transparent',
            cursor: 'pointer',
          }}
          title="Show legend"
        >
          {allDots.map((item, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0, border: '1px solid #e2e8f0', display: 'inline-block' }} />
          ))}
        </button>
      )}

      {/* Expanded: full legend */}
      {open && (
        <div style={{ padding: '10px 14px', minWidth: 150 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              {MODE_TITLES[mode]}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: '0 0 0 8px' }}
              title="Minimize legend"
            >−</button>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: 2, background: item.color, flexShrink: 0, border: '1px solid #e2e8f0' }} />
              <span style={{ fontSize: 12, color: '#475569' }}>
                {'value' in item ? `${item.value} · ` : ''}{item.label}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: '#cccccc', flexShrink: 0, border: '1px solid #e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#475569' }}>No data</span>
          </div>
        </div>
      )}
    </div>
  );
}
