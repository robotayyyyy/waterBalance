# Water Visualization Page

Simple, extensible water visualization prototype with dropdown mode selection.

## Features

- **Dropdown selection** for different visualization modes
- **Three modes included:**
  - Water Level (Color-Coded) - Shows basins colored by water amount
  - Basins Only - Simple basin outlines
  - Rivers Only - River network display
- **Color-coded legend** (for water level mode)
- **Interactive popups** with detailed information
- **Responsive design**

## File Structure

```
water/
├── page.tsx                  # Main page with dropdown control
├── WaterMapComponent.tsx     # Map rendering component
└── README.md                 # This file

Shared components:
../map/
├── colorScale.ts             # Color scale utilities
└── WaterLegend.tsx          # Legend component
```

## How to Use

1. Navigate to `/water` route in your browser
2. Use the dropdown to select visualization mode
3. Map updates automatically when mode changes
4. Click on features for detailed information

## Extending the Visualization

### Adding New Visualization Modes

1. **Define new mode in `WaterMapComponent.tsx`:**

```typescript
export type VisualizationMode = 'water-level' | 'basins-only' | 'rivers-only' | 'your-new-mode';
```

2. **Add to visualization options:**

```typescript
const VISUALIZATION_OPTIONS: VisualizationOption[] = [
  // ... existing options
  {
    value: 'your-new-mode',
    label: 'Your New Mode',
    description: 'Description of what this mode shows',
  },
];
```

3. **Add data fetching logic:**

```typescript
// In fetchData function
if (mode === 'your-new-mode') {
  promises.push(fetch(`${apiUrl}/api/geo/your-endpoint`));
}
```

4. **Add rendering logic:**

```typescript
{mode === 'your-new-mode' && mapData.yourNewData && (
  <GeoJSON
    key={`your-mode-${JSON.stringify(mapData.yourNewData)}`}
    data={mapData.yourNewData}
    style={yourStyleFunction}
    onEachFeature={yourFeatureHandler}
  />
)}
```

### Adding Filter Controls

Example: Add a date range filter

1. **Add state in `page.tsx`:**

```typescript
const [dateRange, setDateRange] = useState({ start: '', end: '' });
```

2. **Add UI control:**

```tsx
<input
  type="date"
  value={dateRange.start}
  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
/>
```

3. **Pass as prop to WaterMapComponent:**

```tsx
<WaterMapComponent mode={selectedMode} dateRange={dateRange} />
```

4. **Use in API fetch:**

```typescript
fetch(`${apiUrl}/api/geo/basins/water-data?start_date=${dateRange.start}`);
```

### Customizing Colors

Edit `colorScale.ts`:

```typescript
export const WATER_LEVEL_COLORS = {
  excellent: '#your-color',
  // ... other colors
};
```

### Adding New Layers

1. **Add to MapData interface:**

```typescript
interface MapData {
  // ... existing
  yourNewLayer: FeatureCollection | null;
}
```

2. **Fetch in useEffect:**

```typescript
promises.push(fetch(`${apiUrl}/api/geo/your-layer`));
```

3. **Render with GeoJSON component:**

```tsx
<GeoJSON
  data={mapData.yourNewLayer}
  style={yourStyle}
  onEachFeature={yourHandler}
/>
```

## Styling Tips

### Custom Popup Styles

```typescript
layer.bindPopup(`
  <div style="padding: 12px; max-width: 300px;">
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 8px;">${title}</h3>
    <p style="color: #6b7280;">${content}</p>
  </div>
`);
```

### Dynamic Feature Styling

```typescript
style={(feature) => {
  const value = feature?.properties?.yourValue;
  return {
    fillColor: calculateColor(value),
    fillOpacity: 0.6,
    color: '#333',
    weight: 2,
  };
}}
```

### Hover Effects

```typescript
layer.on({
  mouseover: (e) => {
    e.target.setStyle({
      fillOpacity: 0.8,
      weight: 3,
    });
  },
  mouseout: (e) => {
    e.target.setStyle({
      fillOpacity: 0.6,
      weight: 2,
    });
  },
});
```

## Performance Tips

### For Large Datasets

1. **Use bounding box filtering:**

```typescript
const bounds = map.getBounds();
const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
fetch(`${apiUrl}/api/geo/basins/water-data?bbox=${bbox}`);
```

2. **Simplify geometries at low zoom:**

```typescript
// Backend: Add ST_Simplify based on zoom level
ST_AsGeoJSON(ST_Simplify(geometry, 0.01))::json
```

3. **Debounce map updates:**

```typescript
const debouncedFetch = useMemo(
  () => debounce((bounds) => fetchData(bounds), 500),
  []
);
```

## API Requirements

The water visualization requires these endpoints:

- `GET /api/geo/basins/water-data` - Basins with water amount data
- `GET /api/geo/basins` - All basins (for basins-only mode)
- `GET /api/geo/rivers` - All rivers (for rivers-only mode)

### Expected Response Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "name": "Basin Name",
        "water_amount_m3": 5000000,
        "water_level_percentage": 85.0,
        "category": "excellent",
        "last_updated": "2026-01-11T..."
      }
    }
  ]
}
```

## Future Enhancement Ideas

- **Time slider** for historical data
- **Comparison mode** (side-by-side maps)
- **Export functionality** (PNG, PDF, GeoJSON)
- **Search/filter by basin name**
- **Measurement tools** (distance, area)
- **Drawing tools** for custom regions
- **Real-time updates** via WebSocket
- **3D terrain visualization**
- **Animation of water level changes**

## Troubleshooting

### Map not rendering
- Check browser console for errors
- Verify backend API is running
- Check `NEXT_PUBLIC_API_URL` environment variable

### Data not loading
- Test API endpoint directly: `curl http://localhost:3001/api/geo/basins/water-data`
- Check network tab in browser DevTools
- Verify CORS settings on backend

### Colors not showing correctly
- Verify `category` field exists in API response
- Check color scale values in `colorScale.ts`
- Inspect feature properties in browser console

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```
