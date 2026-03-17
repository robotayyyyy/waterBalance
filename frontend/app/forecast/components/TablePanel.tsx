'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function TablePanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(720);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX;
    setWidth(Math.max(200, Math.min(720, dragRef.current.startWidth + delta)));
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Clean up listeners if component unmounts mid-drag
  useEffect(() => () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      className="fc-table-panel"
      style={{
        width: open ? width : 32,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'row',
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        overflow: 'hidden',
        transition: dragRef.current ? 'none' : 'width 0.2s ease',
      }}
    >
      {/* Drag handle */}
      {open && (
        <div
          onMouseDown={onDragStart}
          style={{
            width: 5,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            borderRight: '1px solid #e2e8f0',
          }}
          title="Drag to resize"
        />
      )}

      {/* Toggle button */}
      <button
        className="fc-table-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Hide table' : 'Show table'}
        style={{
          width: 27,
          flexShrink: 0,
          border: 'none',
          background: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {open ? '▶' : '◀'}
      </button>

      {/* Table content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Data Table</span>
        </div>
        {children}
      </div>
    </div>
  );
}
