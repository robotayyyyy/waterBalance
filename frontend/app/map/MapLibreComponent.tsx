'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapData {
  rivers: FeatureCollection | null;
  basins: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

interface PopupInfo {
  longitude: number;
  latitude: number;
  content: string;
}

export default function MapLibreComponent() {
  const mapRef = useRef<MapRef>(null);
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

  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | number | null>(null);

  // Fetch data
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

  // Fit bounds when data loads
  useEffect(() => {
    if (mapData.basins && mapData.basins.features.length > 0 && mapRef.current) {
      // Calculate bounds from GeoJSON
      const coordinates = mapData.basins.features.flatMap(feature => {
        if (feature.geometry.type === 'Polygon') {
          return feature.geometry.coordinates[0];
        }
        return [];
      });

      if (coordinates.length > 0) {
        const lngs = coordinates.map(coord => coord[0]);
        const lats = coordinates.map(coord => coord[1]);

        const bounds: [[number, number], [number, number]] = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ];

        mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });
      }
    }
  }, [mapData.basins]);

  // Click handler
  const onBasinClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const props = feature.properties;
    setPopupInfo({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat,
      content: `
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${props.name || 'Unnamed Basin'}</h3>
          ${props.area_km2 ? `<p style="margin: 4px 0;"><strong>Area:</strong> ${props.area_km2.toFixed(2)} km²</p>` : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #666;">ID: ${feature.id}</p>
        </div>
      `,
    });
  }, []);

  const onRiverClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const props = feature.properties;
    setPopupInfo({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat,
      content: `
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${props.name || 'Unnamed River'}</h3>
          ${props.length_km ? `<p style="margin: 4px 0;"><strong>Length:</strong> ${props.length_km.toFixed(2)} km</p>` : ''}
          ${props.river_order ? `<p style="margin: 4px 0;"><strong>Stream Order:</strong> ${props.river_order}</p>` : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #666;">ID: ${feature.id}</p>
        </div>
      `,
    });
  }, []);

  // Hover handlers
  const onBasinHover = useCallback((event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      setHoveredFeatureId(event.features[0].id);
    }
  }, []);

  const onBasinLeave = useCallback(() => {
    setHoveredFeatureId(null);
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

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -97.74,
          latitude: 30.27,
          zoom: 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        interactiveLayerIds={['basins-fill', 'rivers-line']}
        onClick={(e) => {
          // Determine which layer was clicked
          if (e.features && e.features.length > 0) {
            const layerId = e.features[0].layer.id;
            if (layerId === 'basins-fill') {
              onBasinClick(e);
            } else if (layerId === 'rivers-line') {
              onRiverClick(e);
            }
          }
        }}
        onMouseMove={(e) => {
          if (e.features && e.features.length > 0 && e.features[0].layer.id === 'basins-fill') {
            onBasinHover(e);
          }
        }}
        onMouseLeave={onBasinLeave}
        cursor={hoveredFeatureId ? 'pointer' : 'default'}
      >
        {/* Basins Layer */}
        {visibleLayers.basins && mapData.basins && (
          <Source id="basins" type="geojson" data={mapData.basins}>
            <Layer
              id="basins-fill"
              type="fill"
              paint={{
                'fill-color': '#3388ff',
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.4,
                  0.2
                ]
              }}
            />
            <Layer
              id="basins-outline"
              type="line"
              paint={{
                'line-color': '#3388ff',
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  3,
                  2
                ]
              }}
            />
          </Source>
        )}

        {/* Rivers Layer */}
        {visibleLayers.rivers && mapData.rivers && (
          <Source id="rivers" type="geojson" data={mapData.rivers}>
            <Layer
              id="rivers-line"
              type="line"
              paint={{
                'line-color': '#0066cc',
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['get', 'river_order'],
                  1, 1,
                  5, 7.5
                ],
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div dangerouslySetInnerHTML={{ __html: popupInfo.content }} />
          </Popup>
        )}
      </Map>
    </div>
  );
}
