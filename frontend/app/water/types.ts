// Shared types and constants for water visualization
// This file doesn't import any client-only libraries, so it's safe for SSR

export type VisualizationMode = 'water-level' | 'basins-only' | 'rivers-only';

export interface VisualizationOption {
  value: VisualizationMode;
  label: string;
  description: string;
}

export const VISUALIZATION_OPTIONS: VisualizationOption[] = [
  {
    value: 'water-level',
    label: 'Water Level (Color-Coded)',
    description: 'Basins colored by water amount',
  },
  {
    value: 'basins-only',
    label: 'Basins Only',
    description: 'Simple basin outlines',
  },
  {
    value: 'rivers-only',
    label: 'Rivers Only',
    description: 'River network display',
  },
];
