'use client';

type Mode = 'drought' | 'runoff' | 'waterbalance';

const DROUGHT_SCALE = [
  { value: 0, label: 'Normal', color: '#2563eb' },
  { value: 1, label: 'Watch', color: '#fbbf24' },
  { value: 2, label: 'Warning', color: '#f97316' },
  { value: 3, label: 'Critical', color: '#dc2626' },
];

const RUNOFF_SCALE = [
  { value: 0, label: 'Normal', color: '#2563eb' },
  { value: 1, label: 'Low', color: '#fbbf24' },
  { value: 2, label: 'High', color: '#f97316' },
  { value: 3, label: 'Extreme', color: '#dc2626' },
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

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      background: '#fff', borderRadius: 6, padding: '10px 14px',
      boxShadow: '0 1px 4px rgba(0,0,0,.15)', minWidth: 150, zIndex: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
        {MODE_TITLES[mode]}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#475569' }}>
            {'value' in item ? `${item.value} · ` : ''}{item.label}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        <div style={{ width: 14, height: 14, borderRadius: 2, background: '#cccccc', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#475569' }}>No data</span>
      </div>
    </div>
  );
}
