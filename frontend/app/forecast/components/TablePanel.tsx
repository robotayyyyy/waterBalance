'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

export default function TablePanel({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(theme.table.maxWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const applyDrag = useCallback((clientX: number) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - clientX;
    setWidth(Math.max(200, Math.min(theme.table.maxWidth, dragRef.current.startWidth + delta)));
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => applyDrag(e.clientX), [applyDrag]);
  const onTouchMove = useCallback((e: TouchEvent) => applyDrag(e.touches[0].clientX), [applyDrag]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', stopDrag);
  }, [onMouseMove, onTouchMove]);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopDrag);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startX: e.touches[0].clientX, startWidth: width };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', stopDrag);
  };

  useEffect(() => () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', stopDrag);
  }, [onMouseMove, onTouchMove, stopDrag]);

  return (
    <div
      className="fc-table-panel"
      style={{
        width: open ? width : theme.sidebar.collapsedWidth,
        display: 'flex',
        flexDirection: 'row',
        background: theme.color.pageBg,
        borderLeft: `1px solid ${theme.color.border}`,
        overflow: 'hidden',
        transition: dragRef.current ? 'none' : 'width 0.2s ease',
      }}
    >
      {/* Drag handle */}
      {open && (
        <div
          onMouseDown={onDragStart}
          onTouchStart={onTouchStart}
          title="Drag to resize"
          style={{
            width: theme.table.dragWidth,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            borderRight: `1px solid ${theme.color.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: theme.color.textMuted, flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* Toggle button */}
      <button
        className="fc-table-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Hide table' : 'Show table'}
        style={{
          width: theme.table.toggleWidth,
          flexShrink: 0,
          border: 'none',
          background: theme.color.surfaceBg,
          borderRight: `1px solid ${theme.color.border}`,
          cursor: 'pointer',
          color: theme.color.textLabel,
          fontSize: theme.fontSize.base,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {open ? '▶' : '◀'}
      </button>

      {/* Table content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '6px 10px', background: theme.color.surfaceBg, borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase' }}>{t.table.title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
