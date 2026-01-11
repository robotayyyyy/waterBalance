// Color scale configuration for water level visualization
export const WATER_LEVEL_COLORS = {
  excellent: '#2563eb',  // Blue - 80-100%
  good: '#3b82f6',       // Light blue - 60-80%
  moderate: '#fbbf24',   // Yellow - 40-60%
  low: '#f97316',        // Orange - 20-40%
  critical: '#dc2626',   // Red - 0-20%
} as const;

export type WaterCategory = keyof typeof WATER_LEVEL_COLORS;

export function getColorByCategory(category: WaterCategory): string {
  return WATER_LEVEL_COLORS[category];
}

export function getCategoryLabel(category: WaterCategory): string {
  const labels: Record<WaterCategory, string> = {
    excellent: '80-100%',
    good: '60-80%',
    moderate: '40-60%',
    low: '20-40%',
    critical: '0-20%',
  };
  return labels[category];
}

// Default styles for different layer types
export const DEFAULT_STYLES = {
  basin: {
    fillOpacity: 0.6,
    color: '#333',
    weight: 2,
    opacity: 0.8,
  },
  river: {
    color: '#0ea5e9',
    weight: 3,
    opacity: 0.7,
  },
};
