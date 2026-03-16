'use client';
import { useState, useEffect } from 'react';

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

  // Sync range inputs to actual data bounds when dates load
  useEffect(() => {
    if (availableDates.length === 0) return;
    setStart(availableDates[0]);
    setEnd(availableDates[availableDates.length - 1]);
  }, [availableDates[0], availableDates[availableDates.length - 1]]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' }}>
      <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>Date Range:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="date" value={start} onChange={e => setStart(e.target.value)}
          style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, color: '#1e293b' }} />
        <span style={{ color: '#94a3b8' }}>→</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)}
          style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, color: '#1e293b' }} />
        <button
          onClick={() => onSearch(start, end)}
          style={{ padding: '4px 14px', border: 'none', borderRadius: 4, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12 }}
        >Search</button>
      </div>

      {availableDates.length > 0 && (
        <>
          <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>Show date:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {availableDates.map(d => (
              <button
                key={d}
                onClick={() => onSelectDate(d)}
                style={{
                  padding: '3px 10px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                  background: selectedDate === d ? '#3b82f6' : '#f8fafc',
                  color: selectedDate === d ? '#fff' : '#475569',
                  borderColor: selectedDate === d ? '#3b82f6' : '#cbd5e1',
                }}
              >{d}</button>
            ))}
          </div>
        </>
      )}

      {availableDates.length === 0 && (
        <span style={{ color: '#94a3b8', fontSize: 12 }}>No data in selected range</span>
      )}
    </div>
  );
}
