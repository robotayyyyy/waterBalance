'use client';

import { useState } from 'react';
import { theme } from '../theme';

type Props = {
  overlayProvince:   boolean;
  overlayAmphoe:     boolean;
  overlayHillshade:  boolean;
  onToggleProvince:  () => void;
  onToggleAmphoe:    () => void;
  onToggleHillshade: () => void;
  viewMode: 'admin' | 'basin';
};

// Small square icon representing boundary level — thicker border = higher level
function BoundaryIcon({ weight }: { weight: 1 | 2 | 3 }) {
  const size = 14;
  const bw = weight === 1 ? 2.5 : weight === 2 ? 1.5 : 1;
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `${bw}px solid currentColor`,
      borderRadius: 2,
      flexShrink: 0,
    }} />
  );
}

export default function OverlayToggle({
  overlayProvince, overlayAmphoe, overlayHillshade,
  onToggleProvince, onToggleAmphoe, onToggleHillshade,
  viewMode,
}: Props) {
  const [open, setOpen] = useState(false);

  const showBoundaries = viewMode === 'basin';

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    fontSize: theme.fontSize.sm,
    fontFamily: 'sans-serif',
    textAlign: 'left',
    transition: 'background 0.15s',
  };

  const btn = (active: boolean, disabled = false): React.CSSProperties => ({
    ...btnBase,
    background: active ? theme.color.primaryLight : 'transparent',
    color: disabled ? theme.color.textMuted : active ? theme.color.primaryDark : theme.color.textBody,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div style={{
      position: 'absolute',
      top: 96,
      right: 10,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
    }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Toggle overlays"
        style={{
          width: 32,
          height: 32,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          background: open ? theme.color.primaryLight : 'rgba(255,255,255,0.95)',
          color: open ? theme.color.primaryDark : theme.color.textLabel,
          cursor: 'pointer',
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        ⊞
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '6px 4px',
          minWidth: 130,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{ padding: '2px 10px 6px', fontSize: theme.fontSize.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
            Overlays
          </div>

          {showBoundaries && (
            <>
              <button style={btn(overlayProvince)} onClick={onToggleProvince}>
                <BoundaryIcon weight={1} />
                Province
              </button>

              <button style={btn(overlayAmphoe)} onClick={onToggleAmphoe}>
                <BoundaryIcon weight={2} />
                Amphoe
              </button>

            </>
          )}

          <button style={btn(overlayHillshade)} onClick={onToggleHillshade}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>⛰</span>
            Hillshade
          </button>
        </div>
      )}
    </div>
  );
}
