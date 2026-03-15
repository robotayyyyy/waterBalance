'use client';

type Province = { id: string; name: string };
type DetailRow = { id: string; name: string; [key: string]: any };

export default function ProvinceSelector({
  provinces,
  selectedProvince,
  onSelect,
  amphoeList,
  tambolList,
}: {
  provinces: Province[];
  selectedProvince: string;
  onSelect: (id: string) => void;
  amphoeList: DetailRow[];
  tambolList: DetailRow[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>

      <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
          Province
        </div>
        <select
          value={selectedProvince}
          onChange={e => onSelect(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#f8fafc', color: '#1e293b', fontSize: 13 }}
        >
          <option value="">— All Thailand —</option>
          {provinces.map(p => (
            <option key={p.id} value={p.id}>{p.id} · {p.name}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedProvince && (
          <>
            <div style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
              Amphoe ({amphoeList.length})
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {amphoeList.map(a => (
                <li key={a.id} style={{ padding: '5px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: 12 }}>
                  {a.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{a.id}</span>
                </li>
              ))}
            </ul>

            <div style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
              Tambol ({tambolList.length})
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {tambolList.map(t => (
                <li key={t.id} style={{ padding: '5px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: 12 }}>
                  {t.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{t.id}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

    </div>
  );
}
