'use client';
import { useState, useEffect, useRef } from 'react';

export default function DateRangePicker({
  onSearch,
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  onSearch: (start: string, end: string) => void;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [start, setStart] = useState('2020-01-01');
  const [end, setEnd] = useState('2030-12-31');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  // Sync range inputs to actual data bounds when dates load
  useEffect(() => {
    if (availableDates.length === 0) return;
    setStart(availableDates[0]);
    setEnd(availableDates[availableDates.length - 1]);
  }, [availableDates[0], availableDates[availableDates.length - 1]]);

  // Auto-scroll date strip to rightmost (latest) date
  useEffect(() => {
    if (stripRef.current && availableDates.length > 0) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, [availableDates]);

  // Middle mouse scroll → horizontal scroll on date strip
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [availableDates.length, isCollapsed]);

  return (
    <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>

      {/* Header bar — always visible, click to collapse/expand */}
      <div
        onClick={() => setIsCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>{isCollapsed ? '▶' : '▼'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', flexShrink: 0 }}>Date Filter</span>
        {selectedDate
          ? <span style={{ marginLeft: 'auto', fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{selectedDate}</span>
          : <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>No date selected</span>
        }
      </div>

      {/* Expandable content */}
      {!isCollapsed && (
        <div style={{ padding: '4px 16px 10px', borderTop: '1px solid #f1f5f9' }}>

          {/* Range inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>Range:</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, color: '#1e293b', minHeight: 32 }} />
            <span style={{ color: '#94a3b8' }}>→</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, color: '#1e293b', minHeight: 32 }} />
            <button
              onClick={e => { e.stopPropagation(); onSearch(start, end); }}
              style={{ padding: '4px 14px', border: 'none', borderRadius: 4, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12, minHeight: 32 }}
            >Search</button>
          </div>

          {/* Date buttons — horizontal scroll, no wrap */}
          {availableDates.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={e => { e.stopPropagation(); if (stripRef.current) stripRef.current.scrollLeft -= 200; }}
                style={{ flexShrink: 0, width: 24, height: 30, border: '1px solid #cbd5e1', borderRadius: 4, background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
              >‹</button>
              <div className="fc-date-strip" ref={stripRef} style={{ flex: 1 }}>
                {availableDates.map(d => (
                  <button
                    key={d}
                    onClick={e => { e.stopPropagation(); onSelectDate(d); }}
                    style={{
                      flexShrink: 0,
                      padding: '4px 10px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 12, minHeight: 30,
                      background: selectedDate === d ? '#3b82f6' : '#f8fafc',
                      color: selectedDate === d ? '#fff' : '#475569',
                      borderColor: selectedDate === d ? '#3b82f6' : '#cbd5e1',
                    }}
                  >{d}</button>
                ))}
              </div>
              <button
                onClick={e => { e.stopPropagation(); if (stripRef.current) stripRef.current.scrollLeft += 200; }}
                style={{ flexShrink: 0, width: 24, height: 30, border: '1px solid #cbd5e1', borderRadius: 4, background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}
              >›</button>
            </div>
          )}

          {availableDates.length === 0 && (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>No data in selected range</span>
          )}
        </div>
      )}
    </div>
  );
}
