'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

export default function DateRangePicker({
  availableDates,
  selectedDate,
  onSelectDate,
  formatDate,
}: {
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  formatDate?: (d: string) => string;
}) {
  const fmt = formatDate ?? ((d: string) => d);
  const { t } = useLang();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

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
