'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapData {
  rivers: FeatureCollection | null;
  basins: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

// Component to fit map bounds to data
function FitBounds({ basins }: { basins: FeatureCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (basins && basins.features.length > 0) {
      const geoJsonLayer = L.geoJSON(basins);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [basins, map]);

  return null;
}

export default function MapComponent() {
  const [mapData, setMapData] = useState<MapData>({
    rivers: null,
    basins: null,
    loading: true,
    error: null,
  });

  const [visibleLayers, setVisibleLayers] = useState({
    basins: true,
    rivers: true,
  });

  useEffect(() => {
    const fetchGeoData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        const [riversResponse, basinsResponse] = await Promise.all([
          fetch(`${apiUrl}/api/geo/rivers`),
          fetch(`${apiUrl}/api/geo/basins`),
        ]);

        if (!riversResponse.ok || !basinsResponse.ok) {
          throw new Error('Failed to fetch geo data');
        }

        const [rivers, basins] = await Promise.all([
          riversResponse.json(),
          basinsResponse.json(),
        ]);

        setMapData({
          rivers,
          basins,
          loading: false,
          error: null,
        });
      } catch (err) {
        setMapData({
          rivers: null,
          basins: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        console.error('Error fetching geo data:', err);
      }
    };

    fetchGeoData();
  }, []);

  if (mapData.loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (mapData.error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Map</h2>
          <p className="text-gray-600 mb-4">{mapData.error}</p>
          <p className="text-sm text-gray-500">
            Make sure the backend API is running on{' '}
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm mb-2">Map Layers</h3>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visibleLayers.basins}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, basins: e.target.checked })
            }
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">Basins</span>
          <span
            className="w-4 h-4 rounded border-2 border-blue-500"
            style={{ backgroundColor: 'rgba(51, 136, 255, 0.2)' }}
          ></span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visibleLayers.rivers}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, rivers: e.target.checked })
            }
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">Rivers</span>
          <span className="w-8 h-1 bg-blue-600 rounded"></span>
        </label>
        <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
          {mapData.basins?.features.length || 0} basins,{' '}
          {mapData.rivers?.features.length || 0} rivers
        </div>
      </div>

      {/* Map Title */}
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3">
        <h1 className="text-lg font-bold text-gray-800">WaterF Basin Viewer</h1>
        <p className="text-xs text-gray-500">Watershed & River Network</p>
      </div>

      <MapContainer
        center={[30.27, -97.74]} // Default center (Austin, TX area)
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Auto-fit bounds to basins */}
        <FitBounds basins={mapData.basins} />

        {/* Basins Layer */}
        {visibleLayers.basins && mapData.basins && (
          <GeoJSON
            data={mapData.basins}
            style={{
              fillColor: '#3388ff',
              fillOpacity: 0.2,
              color: '#3388ff',
              weight: 2,
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              layer.bindPopup(`
                <div class="p-2">
                  <h3 class="font-bold text-lg mb-2">${props.name || 'Unnamed Basin'}</h3>
                  ${props.area_km2 ? `<p class="text-sm"><strong>Area:</strong> ${props.area_km2.toFixed(2)} km²</p>` : ''}
                  <p class="text-xs text-gray-500 mt-1">ID: ${feature.id}</p>
                </div>
              `);

              // Highlight on hover
              layer.on({
                mouseover: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    fillOpacity: 0.4,
                    weight: 3,
                  });
                },
                mouseout: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    fillOpacity: 0.2,
                    weight: 2,
                  });
                },
              });
            }}
          />
        )}

        {/* Rivers Layer */}
        {visibleLayers.rivers && mapData.rivers && (
          <GeoJSON
            data={mapData.rivers}
            style={(feature) => {
              // Style based on river order (if available)
              const order = feature?.properties?.river_order || 1;
              const width = Math.max(1, order * 1.5);
              return {
                color: '#0066cc',
                weight: width,
                opacity: 0.8,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              layer.bindPopup(`
                <div class="p-2">
                  <h3 class="font-bold text-lg mb-2">${props.name || 'Unnamed River'}</h3>
                  ${props.length_km ? `<p class="text-sm"><strong>Length:</strong> ${props.length_km.toFixed(2)} km</p>` : ''}
                  ${props.river_order ? `<p class="text-sm"><strong>Stream Order:</strong> ${props.river_order}</p>` : ''}
                  <p class="text-xs text-gray-500 mt-1">ID: ${feature.id}</p>
                </div>
              `);

              // Highlight on hover
              layer.on({
                mouseover: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    weight: (feature?.properties?.river_order || 1) * 2,
                    color: '#0044aa',
                  });
                },
                mouseout: (e) => {
                  const layer = e.target;
                  const order = feature?.properties?.river_order || 1;
                  layer.setStyle({
                    weight: Math.max(1, order * 1.5),
                    color: '#0066cc',
                  });
                },
              });
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
