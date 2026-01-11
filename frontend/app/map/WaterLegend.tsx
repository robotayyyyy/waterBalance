import { WATER_LEVEL_COLORS, getCategoryLabel, type WaterCategory } from './colorScale';

interface WaterLegendProps {
  visible?: boolean;
}

export function WaterLegend({ visible = true }: WaterLegendProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '30px',
        right: '10px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '180px',
      }}
    >
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Water Level
      </h4>
      {(Object.entries(WATER_LEVEL_COLORS) as [WaterCategory, string][]).map(([category, color]) => (
        <div
          key={category}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '18px',
              backgroundColor: color,
              marginRight: '8px',
              border: '1px solid #ccc',
              borderRadius: '3px',
            }}
          />
          <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>
            {category} <span style={{ fontSize: '11px', color: '#666' }}>({getCategoryLabel(category)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}
