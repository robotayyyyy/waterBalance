'use client';

import { type CSSProperties } from 'react';
import { theme } from '../theme';
import { useLang } from '../../i18n/LangContext';
import { AGRI_CROPS, AGRI_CROPS_BY_BASIN } from '../agriculture';

type Props = {
  overlayProvince:    boolean;
  overlayAmphoe:      boolean;
  overlayRivers:      boolean;
  overlayHillshade:   boolean;
  overlayBasemap:     boolean;
  overlayReservoirS:   boolean;
  overlayReservoirM:   boolean;
  overlayReservoirL:   boolean;
  onToggleProvince:    () => void;
  onToggleAmphoe:      () => void;
  onToggleRivers:      () => void;
  onToggleHillshade:   () => void;
  onToggleBasemap:     () => void;
  onToggleReservoirS:  () => void;
  onToggleReservoirM:  () => void;
  onToggleReservoirL:  () => void;
  // Agriculture: master toggle = all/none; enabledCrops drives per-crop rows.
  watershed: 'ping' | 'yom';
  enabledCrops: Set<string>;
  onToggleAgriculture: () => void;        // all/none
  onToggleCrop: (code: string) => void;   // individual crop
  viewMode: 'admin' | 'basin';
  onClose?: () => void;                    // collapse the drawer (× in header)
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

function RiverIcon() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, position: 'relative', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, background: theme.mapLine.river.color, transform: 'translateY(-50%)', borderRadius: 1 }} />
    </span>
  );
}

function ReservoirIcon() {
  return <span style={{ fontSize: 13, lineHeight: 1 }}>🌢</span>;
}

export default function OverlayToggle({
  overlayProvince, overlayAmphoe, overlayRivers, overlayHillshade, overlayBasemap,
  overlayReservoirS, overlayReservoirM, overlayReservoirL,
  onToggleProvince, onToggleAmphoe, onToggleRivers, onToggleHillshade, onToggleBasemap,
  onToggleReservoirS, onToggleReservoirM, onToggleReservoirL,
  watershed, enabledCrops, onToggleAgriculture, onToggleCrop,
  viewMode,
  onClose,
}: Props) {
  const { t, locale } = useLang();
  const cropCodes = AGRI_CROPS_BY_BASIN[watershed];
  const agricultureOn = enabledCrops.size > 0;

  const showBoundaries = true;

  const btnBase: CSSProperties = {
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

  const btn = (active: boolean, disabled = false): CSSProperties => ({
    ...btnBase,
    background: active ? theme.color.primaryLight : 'transparent',
    color: disabled ? theme.color.textMuted : active ? theme.color.primaryDark : theme.color.textBody,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    // Panel content fills the drawer column — its own flex track BESIDE the map (see ForecastLayout),
    // never overlapping the WebGL canvas. That's what keeps its scroll container from triggering the
    // map's black-rectangle compositing artifact. Open/close + the floating ⊞ button live in ForecastLayout.
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: '#ffffff',
      padding: '6px 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 6px 10px' }}>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          {t.overlay.label}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            title="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: theme.color.textMuted, padding: 2 }}
          >
            ×
          </button>
        )}
      </div>

      {showBoundaries && (
            <>
              <button style={btn(overlayProvince)} onClick={onToggleProvince}>
                <BoundaryIcon weight={1} />
                {t.overlay.province}
              </button>

              <button style={btn(overlayAmphoe)} onClick={onToggleAmphoe}>
                <BoundaryIcon weight={2} />
                {t.overlay.amphoe}
              </button>

            </>
          )}

          <button style={btn(overlayRivers)} onClick={onToggleRivers}>
            <RiverIcon />
            {t.overlay.rivers}
          </button>

          <button style={btn(overlayReservoirS)} onClick={onToggleReservoirS}>
            <ReservoirIcon />
            {t.overlay.reservoirS}
          </button>

          <button style={btn(overlayReservoirM)} onClick={onToggleReservoirM}>
            <ReservoirIcon />
            {t.overlay.reservoirM}
          </button>

          <button style={btn(overlayReservoirL)} onClick={onToggleReservoirL}>
            <ReservoirIcon />
            {t.overlay.reservoirL}
          </button>

          <button style={btn(overlayHillshade)} onClick={onToggleHillshade}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>⛰</span>
            {t.overlay.hillshade}
          </button>

          {/* Agriculture: master row = all/none; indented crop rows toggle each crop */}
          <button style={btn(agricultureOn)} onClick={onToggleAgriculture}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>𖧧</span>
            {t.overlay.agriculture}
          </button>
          {cropCodes.map(code => {
            const crop = AGRI_CROPS[code];
            if (!crop) return null;
            const on = enabledCrops.has(code);
            return (
              <button
                key={code}
                style={{ ...btn(on), paddingLeft: 26, fontSize: theme.fontSize.xs }}
                onClick={() => onToggleCrop(code)}
              >
                <span style={{
                  width: 11, height: 11, borderRadius: 2, flexShrink: 0,
                  background: crop.color, border: `1px solid ${theme.color.border}`,
                  opacity: on ? 1 : 0.45, display: 'inline-block',
                }} />
                {locale === 'th' ? crop.th : crop.en}
              </button>
            );
          })}

          <div style={{ height: 1, background: theme.color.border, margin: '4px 8px' }} />

      <button style={btn(overlayBasemap)} onClick={onToggleBasemap}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>🗺</span>
        {t.overlay.basemap}
      </button>
    </div>
  );
}
