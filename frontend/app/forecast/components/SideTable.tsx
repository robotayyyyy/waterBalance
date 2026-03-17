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

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };
const RUNOFF_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#bee8ff', 2: '#01c5ff', 3: '#005be7' };

function fmt(v: string | number, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

function exportCsv(rows: Row[], activeLevel: string) {
  const levelLabel = activeLevel === 'province' ? 'Province' : activeLevel === 'amphoe' ? 'Amphoe' : 'Tambon';
  const headers = [levelLabel, 'ID', 'Rainfall (mm)', 'Watersupply', 'Reservoir (%)', 'Water Demand', 'Water Balance', 'Drought Index', 'Runoff Index'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.name}"`, r.id, r.rainfall, r.watersupply, r.reservoir, r.water_demand, r.water_balance, r.drought_index, r.runoff_index,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `water-forecast-${activeLevel}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SideTable({ rows, activeLevel }: { rows: Row[]; activeLevel: string }) {
  if (rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, background: '#fff' }}>
        No data — select a date range and date
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#fafafa' }}>
        <button
          onClick={() => exportCsv(rows, activeLevel)}
          style={{ padding: '3px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#475569', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[activeLevel === 'province' ? 'Province' : activeLevel === 'amphoe' ? 'Amphoe' : 'Tambon',
                'Rainfall (mm)', 'Watersupply', 'Reservoir (%)', 'WaterDemand', 'WaterBalance', 'Drought', 'Runoff'
              ].map((h, i) => (
                <th key={h} style={{
                  padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                  position: 'sticky', top: 0, zIndex: i === 0 ? 3 : 1,
                  ...(i === 0 ? { left: 0, zIndex: 3 } : {}),
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 10px', color: '#1e293b', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #e2e8f0' }}>
                  {r.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.id}</span>
                </td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.rainfall)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.watersupply)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.reservoir)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.water_demand)}</td>
                <td style={{ padding: '6px 10px', fontWeight: 500, whiteSpace: 'nowrap', color: Number(r.water_balance) >= 0 ? '#2563eb' : '#dc2626' }}>{fmt(r.water_balance)}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: DROUGHT_COLORS[r.drought_index] ?? '#cccccc', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.drought_index}</span>
                  </span>
                </td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: RUNOFF_COLORS[r.runoff_index] ?? '#cccccc', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.runoff_index}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
