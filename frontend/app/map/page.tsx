'use client';

import dynamic from 'next/dynamic';
import 'maplibre-gl/dist/maplibre-gl.css';

// Dynamically import map component to avoid SSR issues
const MapLibreComponent = dynamic(() => import('./MapLibreComponent'), {
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

export default function MapPage() {
  return (
    <div className="w-full h-screen">
      <MapLibreComponent />
    </div>
  );
}
