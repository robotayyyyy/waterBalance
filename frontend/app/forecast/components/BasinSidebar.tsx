'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';

export type Basin = 'ping' | 'yom';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };

const BASIN_META: Record<Basin, { label: string; labelTh: string; mbCode: string }> = {
  ping: { label: 'Ping', labelTh: 'ปิง', mbCode: '06' },
  yom:  { label: 'Yom',  labelTh: 'ยม',  mbCode: '08' },
};

type ColorRow = { id: string; value: number };
type DetailRow = { id: string; name?: string; mb_code?: string; [k: string]: any };

function SectionHeader({ label, count, selectedName, selectedId, onDeselect, isCollapsed, onToggle }: {
  label: string;
  count?: number | null;
  selectedName?: string;
  selectedId?: string;
  onDeselect?: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#64748b',
        textTransform: 'uppercase', background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 4, cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ color: '#94a3b8', fontSize: 9 }}>{isCollapsed ? '▶' : '▼'}</span>
        <span>{label}</span>
      </div>
      {selectedName && onDeselect ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName}
            {selectedId && <span style={{ color: '#93c5fd', fontWeight: 400, marginLeft: 3 }}>{selectedId}</span>}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDeselect(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}
          >×</button>
        </div>
      ) : (
        <span style={{ fontWeight: 400, color: '#94a3b8' }}>{count ?? ''}</span>
      )}
    </div>
  );
}

export default function BasinSidebar({
  basinLevel, selectedBasin, selectedL1,
  colorData, detailData,
  onSelectBasin, onSelectL1,
  onDrillL1, onDrillL2, onBack,
}: {
  basinLevel: BasinLevel;
  selectedBasin: Basin | null;
  selectedL1: string | null;
  colorData: ColorRow[];
  detailData: DetailRow[];
  onSelectBasin: (b: Basin) => void;
  onSelectL1: (sbCode: string) => void;
  onDrillL1: () => void;
  onDrillL2: () => void;
  onBack: () => void;
}) {
  const { locale } = useLang();
  const basinName = (b: Basin) => locale === 'th' ? BASIN_META[b].labelTh : BASIN_META[b].label;

  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  const [watershedCollapsed, setWatershedCollapsed] = useState(false);
  const [l1Collapsed, setL1Collapsed] = useState(false);
  const [l2Collapsed, setL2Collapsed] = useState(false);

  // Mirror ProvinceSelector auto-collapse behaviour
  useEffect(() => { setWatershedCollapsed(basinLevel !== 'watershed'); }, [basinLevel]);
  useEffect(() => { if (basinLevel === 'subbasin-l1') setL1Collapsed(false); }, [basinLevel]);
  useEffect(() => { if (basinLevel === 'subbasin-l2') setL2Collapsed(false); }, [basinLevel]);

  const showL1 = basinLevel === 'subbasin-l1' || basinLevel === 'subbasin-l2';
  const showL2 = basinLevel === 'subbasin-l2';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Watershed section */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        flex: watershedCollapsed ? 'none' : (basinLevel === 'watershed' ? 1 : 'none'),
        minHeight: 0, borderBottom: '1px solid #e2e8f0',
      }}>
        <SectionHeader
          label="Watershed"
          count={2}
          isCollapsed={watershedCollapsed}
          onToggle={() => setWatershedCollapsed(c => !c)}
        />
        {!watershedCollapsed && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
              {(['ping', 'yom'] as Basin[]).map(b => {
                const meta = BASIN_META[b];
                const droughtVal = colorMap.get(meta.mbCode);
                const isSelected = selectedBasin === b;
                return (
                  <li
                    key={b}
                    onClick={() => onSelectBasin(b)}
                    style={{
                      padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer', fontSize: 12,
                      background: isSelected ? '#eff6ff' : 'transparent',
                      color: isSelected ? '#1d4ed8' : '#475569',
                      fontWeight: isSelected ? 600 : 400,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {droughtVal !== undefined && (
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1 }}>{basinName(b)}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{meta.mbCode}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Sub-basin L1 section */}
      {showL1 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          flex: l1Collapsed ? 'none' : (basinLevel === 'subbasin-l1' ? 1 : 'none'),
          minHeight: 0, borderBottom: '1px solid #e2e8f0',
        }}>
          <SectionHeader
            label="Sub-basin L1"
            count={basinLevel === 'subbasin-l1' ? detailData.length : null}
            selectedName={selectedBasin ? basinName(selectedBasin) : undefined}
            selectedId={selectedBasin ? BASIN_META[selectedBasin].mbCode : undefined}
            onDeselect={onBack}
            isCollapsed={l1Collapsed}
            onToggle={() => setL1Collapsed(c => !c)}
          />
          {!l1Collapsed && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
                {detailData.map(row => {
                  const droughtVal = colorMap.get(row.id);
                  const isSelected = selectedL1 === row.id;
                  return (
                    <li
                      key={row.id}
                      onClick={() => onSelectL1(row.id)}
                      style={{
                        padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer', fontSize: 12,
                        background: isSelected ? '#eff6ff' : 'transparent',
                        color: isSelected ? '#1d4ed8' : '#475569',
                        fontWeight: isSelected ? 600 : 400,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {droughtVal !== undefined && (
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name || row.id}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>{row.id}</span>
                    </li>
                  );
                })}
              </ul>
              {basinLevel === 'subbasin-l1' && (
                <div
                  onClick={onDrillL2}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    color: '#3b82f6', background: '#eff6ff',
                    borderTop: '1px solid #e2e8f0', flexShrink: 0,
                    cursor: 'pointer', userSelect: 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>Sub-basins L2</span>
                  <span>→</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-basin L2 section */}
      {showL2 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          flex: l2Collapsed ? 'none' : 1,
          minHeight: 0,
        }}>
          <SectionHeader
            label="Sub-basin L2"
            count={detailData.length}
            selectedName={selectedL1 ?? (selectedBasin ? basinName(selectedBasin) : undefined)}
            onDeselect={onBack}
            isCollapsed={l2Collapsed}
            onToggle={() => setL2Collapsed(c => !c)}
          />
          {!l2Collapsed && (
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
              {detailData.map(row => {
                const droughtVal = colorMap.get(row.id);
                return (
                  <li
                    key={row.id}
                    style={{
                      padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                      fontSize: 12, color: '#475569',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {droughtVal !== undefined && (
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                    )}
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>#{row.id}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

    </div>
  );
}
