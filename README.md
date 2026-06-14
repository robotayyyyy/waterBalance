# WaterF

Thailand geospatial water forecast app. Shows SWAT hydrological model outputs on an interactive map for the Ping and Yom river watersheds, in two geographic views: **basin** (watershed/subbasin) and **admin** (province/amphoe/tambon).

---

## How it works

### Data pipeline (upstream)

A separate repo (`waterBalanceScript`) runs on an EC2 server and populates the database automatically on a cron schedule:

- **Weekly** (every Monday 01:00) — runs the Yom SWAT simulation for a 7-day window
- **Monthly** (1st of each month 02:00) — runs the Yom SWAT simulation for a 6-month window

Each run downloads weather input data (rain, temperature, humidity, wind, solar) from `tiservice.hii.or.th`, writes SWAT input files, executes the SWAT model, parses the outputs into CSVs, then bulk-imports them into PostgreSQL. The import does a `DELETE WHERE mb_code = ?` followed by a fresh insert, so the app always reads current data. If any step fails, the database is left untouched and an email alert is sent.

### App (this repo)

The app is read-only with respect to the database — it only queries, never writes.

When a user opens `http://localhost/forecast/yom`:

1. **Next.js** serves the React app. MapLibre GL initialises the map.
2. **MapLibre** requests vector tiles for the geographic shapes (subbasin polygons, province borders, rivers) from tileserver-gl via Nginx at `/tiles/data/{name}/{z}/{x}/{y}.pbf`. These tiles are cached in the browser for 24 hours — geometry never changes.
3. The frontend calls the **NestJS API** (`/api/basin/dates`) to fetch available forecast dates, then fetches color data (`/api/basin/subbasin-l1?date=...&mode=runoff&model=7days&mb_code=08`) and detail rows in parallel.
4. Color data is applied client-side via MapLibre's `setPaintProperty` — a `match` expression maps each subbasin ID to a hex color. No tile re-fetch required.
5. The user navigates the hierarchy (watershed → subbasin-l1 → subbasin-l2, or province → amphoe → tambon). Each drill-down dispatches a state action, triggers a new API fetch, and recolors the map.

### Tile delivery

PMTiles files (`.pmtiles`) store all vector tile geometry as single archive files in `frontend/public/thaimap/`. They are served through **tileserver-gl**, which reads the archives and serves individual tiles as `.pbf` (Mapbox Vector Tile format) over normal HTTP.

> PMTiles normally allows the browser to range-request tiles directly from a single file, eliminating the tile server entirely. The production server sits behind a VPN that blocks HTTP `Range` headers, making direct PMTiles delivery impossible — tileserver-gl is used as a workaround.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, MapLibre GL |
| Backend | NestJS 11, TypeORM |
| Database | PostgreSQL 16 + PostGIS 3.5 |
| Tile server | tileserver-gl (PMTiles → vector tiles .pbf) |
| Infrastructure | Docker Compose, Nginx |
| Basemap | Protomaps (vector) + MapTiler (hillshading) |
| Data pipeline | SWAT model via `waterBalanceScript` (separate repo, EC2) |

---

## Running the app

```bash
# First time
make setup-local        # copy .env.local → .env

# Docker (full stack — use this, access at http://localhost)
make up
make down
make restart
make hard-reset         # destroys volumes, full rebuild

# Native dev (backend + frontend only, DB must be running)
make db && make backend && make frontend

# Import forecast data into DB
make import-forecast-7days
make import-forecast-6months
```

Access the app at **http://localhost** (port 80 via Nginx). Do not use `localhost:3000` directly — that bypasses Nginx and breaks tile URLs.

---

## Regenerating map tiles

Run after any shapefile changes:

```bash
python3 scripts/convert-admin-basin-shapefiles.py   # province/amphoe/tambon PMTiles per basin
python3 scripts/convert-basin-shapefiles.py          # watershed + subbasin L1/L2 PMTiles
python3 scripts/convert-river-shapefiles.py          # river network PMTiles
```

PMTiles are tracked in git.

---

## More documentation

- [`SYSTEM.md`](SYSTEM.md) — full architecture, API reference, DB schema, layer system, state machines
- [`DIAGRAMS.md`](DIAGRAMS.md) — Mermaid diagrams for architecture, data pipeline, and navigation state machines
