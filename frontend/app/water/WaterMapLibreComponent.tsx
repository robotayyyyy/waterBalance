'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getColorByCategory, type WaterCategory } from '../map/colorScale';
import { WaterLegend } from '../map/WaterLegend';
import type { VisualizationMode } from './types';
import { getApiUrl } from '@/lib/api';

interface MapData {
  waterData: FeatureCollection | null;
  basins: FeatureCollection | null;
  rivers: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

interface PopupInfo {
  longitude: number;
  latitude: number;
  content: string;
}

interface WaterMapLibreComponentProps {
  mode: VisualizationMode;
}

export default function WaterMapLibreComponent({ mode }: WaterMapLibreComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapData, setMapData] = useState<MapData>({
    waterData: null,
    basins: null,
    rivers: null,
    loading: true,
    error: null,
  });

  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = getApiUrl();

        // Fetch data based on mode
        let promises: Promise<Response>[] = [];

        if (mode === 'water-level') {
          promises.push(fetch(`${apiUrl}/geo/basins/water-data`));
        } else if (mode === 'basins-only') {
          promises.push(fetch(`${apiUrl}/geo/basins`));
        } else if (mode === 'rivers-only') {
          promises.push(fetch(`${apiUrl}/geo/rivers`));
        }

        const responses = await Promise.all(promises);

        if (responses.some(r => !r.ok)) {
          throw new Error('Failed to fetch data');
        }

        const data = await Promise.all(responses.map(r => r.json()));

        setMapData({
          waterData: mode === 'water-level' ? data[0] : null,
          basins: mode === 'basins-only' ? data[0] : null,
          rivers: mode === 'rivers-only' ? data[0] : null,
          loading: false,
          error: null,
        });
      } catch (err) {
        setMapData({
          waterData: null,
          basins: null,
          rivers: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [mode]);

  // Fit bounds when data loads
  useEffect(() => {
    const displayData = mapData.waterData || mapData.basins || mapData.rivers;
    if (displayData && displayData.features.length > 0 && mapRef.current) {
      const coordinates = displayData.features.flatMap(feature => {
        if (feature.geometry.type === 'Polygon') {
          return feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'LineString') {
          return feature.geometry.coordinates;
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
  }, [mapData]);

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const props = feature.properties;
    let content = '';

    if (mode === 'water-level') {
      content = `
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${props.name || 'Unnamed Basin'}</h3>
          <p style="margin: 4px 0;"><strong>Water Level:</strong> ${props.water_level_percentage?.toFixed(1)}%</p>
          <p style="margin: 4px 0;"><strong>Volume:</strong> ${(props.water_amount_m3 / 1000000).toFixed(2)} million m³</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${props.area_km2?.toFixed(2)} km²</p>
          <p style="margin: 4px 0;"><strong>Status:</strong>
            <span style="color: ${getColorByCategory(props.category)}; font-weight: bold; text-transform: uppercase;">
              ${props.category}
            </span>
          </p>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            Updated: ${new Date(props.last_updated).toLocaleString()}
          </p>
        </div>
      `;
    } else if (mode === 'basins-only') {
      content = `
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${props.name || 'Unnamed Basin'}</h3>
          ${props.area_km2 ? `<p style="margin: 4px 0;"><strong>Area:</strong> ${props.area_km2.toFixed(2)} km²</p>` : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #666;">ID: ${feature.id}</p>
        </div>
      `;
    } else if (mode === 'rivers-only') {
      content = `
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${props.name || 'Unnamed River'}</h3>
          ${props.length_km ? `<p style="margin: 4px 0;"><strong>Length:</strong> ${props.length_km.toFixed(2)} km</p>` : ''}
          ${props.river_order ? `<p style="margin: 4px 0;"><strong>Stream Order:</strong> ${props.river_order}</p>` : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #666;">ID: ${feature.id}</p>
        </div>
      `;
    }

    setPopupInfo({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat,
      content,
    });
  }, [mode]);

  if (mapData.loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {mode} data...</p>
        </div>
      </div>
    );
  }

  if (mapData.error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{mapData.error}</p>
          <p className="text-sm text-gray-500">
            Make sure the backend API is running at{' '}
            <code className="bg-gray-100 px-1">{getApiUrl()}</code>
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
      {/* Show legend only for water level mode */}
      {mode === 'water-level' && <WaterLegend visible={true} />}

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -97.74,
          latitude: 30.27,
          zoom: 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        interactiveLayerIds={
          mode === 'water-level' ? ['water-basins-fill'] :
          mode === 'basins-only' ? ['basins-fill'] :
          mode === 'rivers-only' ? ['rivers-line'] : []
        }
        onClick={onClick}
        onMouseMove={(e) => {
          if (e.features && e.features.length > 0) {
            setHoveredFeatureId(e.features[0].id ?? null);
          }
        }}
        onMouseLeave={() => setHoveredFeatureId(null)}
        cursor={hoveredFeatureId ? 'pointer' : 'default'}
      >
        {/* Water Level Visualization */}
        {mode === 'water-level' && mapData.waterData && (
          <Source id="water-basins" type="geojson" data={mapData.waterData}>
            <Layer
              id="water-basins-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'category'],
                  'excellent', '#2563eb',
                  'good', '#3b82f6',
                  'moderate', '#fbbf24',
                  'low', '#f97316',
                  'critical', '#dc2626',
                  '#ccc'
                ],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.8,
                  0.6
                ]
              }}
            />
            <Layer
              id="water-basins-outline"
              type="line"
              paint={{
                'line-color': '#333',
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  3,
                  2
                ],
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Basins Only Visualization */}
        {mode === 'basins-only' && mapData.basins && (
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

        {/* Rivers Only Visualization */}
        {mode === 'rivers-only' && mapData.rivers && (
          <Source id="rivers" type="geojson" data={mapData.rivers}>
            <Layer
              id="rivers-line"
              type="line"
              paint={{
                'line-color': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  '#0044aa',
                  '#0ea5e9'
                ],
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
