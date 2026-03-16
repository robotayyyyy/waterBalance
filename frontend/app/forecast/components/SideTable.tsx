'use client';

type Row = {
  id: string;
  name: string;
  rainfall: string | number;
  watersupply: string | number;
  reservoir: string | number;
  water_demand: string | number;
  water_balance: string | number;
  drought_index: number;
  runoff_index: number;
};

const DROUGHT_COLORS: Record<number, string> = { 0: '#2563eb', 1: '#fbbf24', 2: '#f97316', 3: '#dc2626' };

function fmt(v: string | number, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

export default function SideTable({ rows, activeLevel }: { rows: Row[]; activeLevel: string }) {
  if (rows.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, background: '#fff', borderTop: '1px solid #e2e8f0' }}>
        No data — select a date range and date
      </div>
    );
  }

  return (
    <div style={{ height: 180, overflowY: 'auto', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {[activeLevel === 'province' ? 'Province' : activeLevel === 'amphoe' ? 'Amphoe' : 'Tambon',
              'Rainfall (mm)', 'Watersupply', 'Reservoir (%)', 'WaterDemand', 'WaterBalance', 'Drought', 'Runoff'
            ].map(h => (
              <th key={h} style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '5px 10px', color: '#1e293b', whiteSpace: 'nowrap' }}>{r.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.id}</span></td>
              <td style={{ padding: '5px 10px', color: '#475569' }}>{fmt(r.rainfall)}</td>
              <td style={{ padding: '5px 10px', color: '#475569' }}>{fmt(r.watersupply)}</td>
              <td style={{ padding: '5px 10px', color: '#475569' }}>{fmt(r.reservoir)}</td>
              <td style={{ padding: '5px 10px', color: '#475569' }}>{fmt(r.water_demand)}</td>
              <td style={{ padding: '5px 10px', fontWeight: 500, color: Number(r.water_balance) >= 0 ? '#2563eb' : '#dc2626' }}>{fmt(r.water_balance)}</td>
              <td style={{ padding: '5px 10px', fontWeight: 600, color: DROUGHT_COLORS[r.drought_index] ?? '#475569' }}>{r.drought_index}</td>
              <td style={{ padding: '5px 10px', fontWeight: 600, color: DROUGHT_COLORS[r.runoff_index] ?? '#475569' }}>{r.runoff_index}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
