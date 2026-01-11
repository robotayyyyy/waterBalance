'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import 'maplibre-gl/dist/maplibre-gl.css';
import { VISUALIZATION_OPTIONS, type VisualizationMode } from './types';

// Dynamically import map component to avoid SSR issues
const WaterMapLibreComponent = dynamic(() => import('./WaterMapLibreComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export default function WaterPage() {
  const [selectedMode, setSelectedMode] = useState<VisualizationMode>('water-level');

  return (
    <div className="w-full h-screen relative">
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-[1001] bg-white rounded-lg shadow-lg p-4 max-w-md">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Water Visualization</h1>
        <p className="text-xs text-gray-500 mb-4">Select visualization mode</p>

        <div className="space-y-2">
          <label htmlFor="viz-mode" className="block text-sm font-medium text-gray-700">
            Visualization Mode
          </label>
          <select
            id="viz-mode"
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as VisualizationMode)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            {VISUALIZATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Description of selected mode */}
          <p className="text-xs text-gray-600 mt-2">
            {VISUALIZATION_OPTIONS.find(opt => opt.value === selectedMode)?.description}
          </p>
        </div>

        {/* Info box */}
        <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Change the visualization mode to see different data representations.
            {selectedMode === 'water-level' && ' Color coding shows water levels from critical (red) to excellent (blue).'}
          </p>
        </div>
      </div>

      {/* Map Component */}
      <WaterMapLibreComponent mode={selectedMode} />
    </div>
  );
}
