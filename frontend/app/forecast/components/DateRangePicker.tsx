'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

export default function DateRangePicker({
  onSearch,
  availableDates,
  selectedDate,
  onSelectDate,
  formatDate,
}: {
  onSearch: (start: string, end: string) => void;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  formatDate?: (d: string) => string;
}) {
  const fmt = formatDate ?? ((d: string) => d);
  const { t } = useLang();
  const [start, setStart] = useState('2020-01-01');
  const [end, setEnd] = useState('2030-12-31');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (availableDates.length === 0) return;
    setStart(availableDates[0]);
    setEnd(availableDates[availableDates.length - 1]);
  }, [availableDates[0], availableDates[availableDates.length - 1]]);

  useEffect(() => {
    if (stripRef.current && availableDates.length > 0) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, [availableDates]);

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

  const inputStyle = {
    padding: '4px 8px', border: `1px solid ${theme.color.borderInput}`,
    borderRadius: theme.radius.md, fontSize: theme.fontSize.sm,
    color: theme.color.textPrimary, minHeight: 32,
  };

  const navBtnStyle = {
    flexShrink: 0, width: 24, height: 30,
    border: `1px solid ${theme.color.borderInput}`, borderRadius: theme.radius.md,
    background: theme.color.surfaceBg, color: theme.color.textBody,
    cursor: 'pointer', fontSize: theme.fontSize.md,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ background: theme.color.pageBg, borderTop: `1px solid ${theme.color.border}`, flexShrink: 0 }}>

      {/* Header bar */}
      <div
        onClick={() => setIsCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs, flexShrink: 0 }}>{isCollapsed ? '▶' : '▼'}</span>
        <span style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', flexShrink: 0 }}>{t.datepicker.label}</span>
        {selectedDate
          ? <span style={{ marginLeft: 'auto', fontSize: theme.fontSize.sm, color: theme.color.primary, fontWeight: 600 }}>{fmt(selectedDate)}</span>
          : <span style={{ marginLeft: 'auto', fontSize: theme.fontSize.sm, color: theme.color.textMuted }}>{t.datepicker.noDate}</span>
        }
      </div>

      {/* Expandable content */}
      {!isCollapsed && (
        <div style={{ padding: '4px 16px 10px', borderTop: `1px solid ${theme.color.subtleBg}` }}>

          {/* Range inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: theme.color.textLabel, fontSize: theme.fontSize.xs, whiteSpace: 'nowrap' }}>{t.datepicker.range}</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
            <span style={{ color: theme.color.textMuted }}>→</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
            <button
              onClick={e => { e.stopPropagation(); onSearch(start, end); }}
              style={{ padding: '4px 14px', border: 'none', borderRadius: theme.radius.md, background: theme.color.primary, color: theme.color.textOnDark, cursor: 'pointer', fontSize: theme.fontSize.sm, minHeight: 32 }}
            >{t.datepicker.search}</button>
          </div>

          {/* Date strip */}
          {availableDates.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={e => { e.stopPropagation(); if (stripRef.current) stripRef.current.scrollLeft -= 200; }}
                style={{ ...navBtnStyle, marginRight: 4 }}
              >‹</button>
              <div className="fc-date-strip" ref={stripRef} style={{ flex: 1 }}>
                {availableDates.map(d => (
                  <button
                    key={d}
                    onClick={e => { e.stopPropagation(); onSelectDate(d); }}
                    style={{
                      flexShrink: 0,
                      padding: '4px 10px', border: '1px solid', borderRadius: theme.radius.md,
                      cursor: 'pointer', fontSize: theme.fontSize.sm, minHeight: 30,
                      background: selectedDate === d ? theme.color.primary : theme.color.surfaceBg,
                      color: selectedDate === d ? theme.color.textOnDark : theme.color.textBody,
                      borderColor: selectedDate === d ? theme.color.primary : theme.color.borderInput,
                    }}
                  >{fmt(d)}</button>
                ))}
              </div>
              <button
                onClick={e => { e.stopPropagation(); if (stripRef.current) stripRef.current.scrollLeft += 200; }}
                style={{ ...navBtnStyle, marginLeft: 4 }}
              >›</button>
            </div>
          )}

          {availableDates.length === 0 && (
            <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.sm }}>{t.datepicker.noData}</span>
          )}
        </div>
      )}
    </div>
  );
}
