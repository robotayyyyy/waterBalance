# CLAUDE.md

## core behavior
- if you are not sure -> ask me
- in case have the plan for implement, if anything not in the plan -> do not do that
- if the plan need to be change or append -> ask me
- Stop reading when you have enough to reason. Read the directly relevant files, identify the issue, explain it. Do not keep reading unrelated files to build certainty.

## Project

WaterF — geospatial Thailand water forecast app. MapLibre GL map + PostGIS backend. Two view modes: **admin** (province/amphoe/tambon) and **basin** (watershed/subbasin-l1/subbasin-l2). Basin mode is the default. Four forecast modes: **runoff**, **drought**, **waterbalance**, **rainfall**.

Stack: Next.js frontend (port 3000) · NestJS backend (port 3001) · PostgreSQL+PostGIS · Nginx (port 80).

## Commands

```bash
# Dev
make db && make backend && make frontend

# Docker (access at http://localhost — NOT localhost:3000)
make up / make down / make restart / make hard-reset

# Data import (DB must be running)
make import-forecast-7days
make import-forecast-6months

# First time
make setup-local   # copies .env.local → .env

# Generate PMTiles + GeoJSON (run after shapefile changes)
python3 scripts/convert-basin-shapefiles.py
python3 scripts/convert-river-shapefiles.py
```

Frontend: `npm run dev / build / lint / test` (from `frontend/`)
E2E tests: `npm run test:e2e` (from `frontend/`) — requires dev server running on port 3000
Backend: `npm run start:dev / test / lint` (from `backend/`)

## Environment

- `DATABASE_HOST` — `postgres` (Docker) or `localhost` (dev)
- `NEXT_PUBLIC_API_URL` — `/api` (Docker) or `http://localhost:3001` (dev)
- `NEXT_PUBLIC_*` vars are baked at **build time** — changing them requires a rebuild.

### Two env files

| File | Used by | Copied to `.env` by |
|------|---------|---------------------|
| `.env.local` | `make frontend` (native dev) | `make frontend` / `make backend` |
| `.env.docker` | `make up` (full Docker) | `make up` |

Never edit `.env` directly — it gets overwritten on every `make up` or `make frontend`.

### Adding a new `NEXT_PUBLIC_*` var

All four places must be updated together or the var will be missing in prod:

1. **`.env.local`** — dev value
2. **`.env.docker`** — prod value
3. **`frontend/Dockerfile`** — add `ARG NEXT_PUBLIC_FOO` and `ENV NEXT_PUBLIC_FOO=$NEXT_PUBLIC_FOO` in the builder stage
4. **`docker-compose.yml`** — add `NEXT_PUBLIC_FOO: ${NEXT_PUBLIC_FOO:-default}` under `build.args`

`docker exec nextjs_app env | grep NEXT_PUBLIC` shows runtime env but **not** the baked build value — a var can appear there and still be wrong in the bundle if it was missing from Dockerfile/build args.

### Tile server (`NEXT_PUBLIC_TILES_BASE_URL`)

Must be an **absolute URL** — MapLibre fetches tiles in a Web Worker where relative URLs fail.

- `.env.local`: `http://localhost/tiles` — nginx (from `make up`) proxies to tileserver
- `.env.docker`: `http://<domain>/tiles` — same nginx proxy, just a different hostname

**Always use `make up` for the tileserver.** `make dev-services` is only needed if running without Docker entirely. After `make up`, access the app at `http://localhost` (port 80) — not `localhost:3000` (that bypasses nginx and breaks tile URLs).

## API Endpoints

Admin forecast (`/forecast`):
- `GET /forecast/dates?model=`
- `GET /forecast/:level?date=&mode=&model=&province_id=` — color data
- `GET /forecast/:level/detail?date=&model=&province_id=` — table rows
- `:level` = `province` | `amphoe` | `tambon`

Basin (`/basin`):
- `GET /basin/dates?model=`
- `GET /basin/:level?date=&mode=&model=&mb_code=` — color data
- `GET /basin/:level/detail?date=&model=&mb_code=` — table rows
- `:level` = `watershed` | `subbasin-l1` | `subbasin-l2`
- `mb_code` omitted at watershed level

## Architecture Notes

**Static geo data** — Province/amphoe/tambon lists from `frontend/public/thailand-geo.json`, NOT the DB. DB only holds forecast values.

**Geographic IDs** — numeric strings from pcode (strip `TH`): province=2 digits, amphoe=4, tambon=6. Parent derivable by slicing.

**Styling** — All inline styles. `forecast.css` only for `@media` breakpoints. Do not use Tailwind or add non-breakpoint CSS.

**i18n** — All strings in `frontend/app/i18n/translations.ts` (en/th). Use `useLang()` → `{ locale, t, setLocale }`.

**Model toggle** — `handleModelChange` fetches dates for new model and auto-selects latest. Do not revert to plain `setModel`.

**Table data filtering** — `/forecast/tambon/detail` returns all tambons in a province. Frontend filters: `detailData.filter(r => r.id.startsWith(selectedAmphoe))`.

## Map Position Constants

`INIT_VIEW` in `useMapInit.ts` is the single source of truth for basin initial center/zoom (used for both map init and flyTo on province deselect in admin mode). Edit there for both basins.

## Admin Map Layers

Three PMTiles sources (adm1/adm2/adm3), each with fill/line/highlight sub-layers.
- Fill layers controlled via `setPaintProperty`, not `setLayoutProperty`
- Filter logic in `useEffect` hooks only, never in event handlers
- `adm1-hit` — invisible fill, no filter, used for province click hit-testing (use this, not `adm1-fill`)
- Highlight = double border: `adm{n}-highlight` (white outer) + `adm{n}-highlight-inner` (color per mode)
- Province deselect flies to `INIT_VIEW[watershed]` (basin center), not Thailand bounds
- All map event handlers in one `useEffect` — do not split

**Fill opacity with detail overlays (hill/river):**
- `fillOpacityReducedRef` in `useMapInit` tracks whether fills should be at `mapFillOpacity` (0.8) or `mapFillOpacityReduced` (0.3)
- `setDataFillOpacity(reduced)` writes the ref and updates all currently-active fills. It skips layers at opacity 0 — dismissed fills must not be resurrected.
- `applyColors` / `applyBasinColors` always read `fillOpacityReducedRef` so drill-downs inherit the correct opacity.
- `getFillOpacity()` is exported from `useMapInit` and passed to `useSelectionHandlers` so province deselect (which resets `adm1-fill`) also respects the ref.

**`handleDrillToAllTambon` filter:** tambon PMTiles (`adm3`) has `adm2_pcode` but **not** `adm1_pcode`. Province filter must use `['slice', ['get', 'adm2_pcode'], 0, 4]` to match the 4-char province prefix (e.g. `TH52`). Using `adm1_pcode` matches nothing.

**Highlight inner color per mode** — `theme.highlightColor` in `theme.ts` is the single source of truth: `runoff` = orange, `drought` = green, `waterbalance` = cyan. `setHighlightColor(mode)` in `useMapInit` applies it to all `*-highlight-inner` layers at runtime. `theme.mapLine.highlightInner.color` must match the **default mode** (`runoff` = orange) — this is the initial layer paint value before any mode is applied. Changing defaults requires updating both.

**`handleTambonSelect` derives province when none selected** — if `selectedProvince` is empty (e.g. came from "All Tambons" at top level), it slices the tambon ID: province = first 2 chars, amphoe = first 4 chars. Calls `updateSidebarLists(provinceId)` to populate `amphoeList`, then immediately overrides `selectedAmphoe` (since `updateSidebarLists` auto-selects the first amphoe). Always calls `updateTambonList(amphoeId)` to ensure the tambon section list is correct.

**Admin click navigation:**
- Province: click → select; re-click selected → drill to amphoe
- Amphoe: click outside province → deselect; click different → select; re-click selected → drill to tambon
- Tambon: click outside amphoe → back; click tambon → select

## Basin State Machine

All basin navigation state is in `basin/basinState.ts` as a pure reducer — no React, no MapLibre.
Managed via `useReducer(basinReducer, initialBasinState)` in `ForecastMap.tsx`.
**Never add `useState` for basin navigation fields** — all belong in the reducer.

The active watershed (`ping`/`yom`) comes from the URL param — it is **NOT** stored in the reducer.

**State fields:** `basinLevel` (`'watershed'|'subbasin-l1'|'subbasin-l2'`), `selectedL1`, `selectedL2`, `l2FilterSbCode`, `l2EntryFromWatershed`

**Initial state:** `basinLevel: 'subbasin-l1'` with all selections null — this IS the default basin view (all L1 polygons colored). `'watershed'` level is only reached via BACK navigation.

**Actions:** `DRILL_TO_L1` · `SELECT_L1` · `DRILL_L2_FROM_L1` · `DRILL_L2` · `DRILL_L2_FROM_WATERSHED` · `SELECT_L2` · `SELECT_L2_FROM_PREVIEW` · `BACK` · `RESET`

**Map layer sync** — One `useEffect` on `[basinLevel, selectedL1, selectedL2, l2FilterSbCode, mapReady, viewMode]` drives all basin layer calls (`setBasinLayersVisible`, `setWatershedHighlight`, `setL1Highlight`, `setL2Highlight`, `setL2SbFilter`). Handlers dispatch only — never call map layer functions directly.

**MB codes** — Ping = `'06'`, Yom = `'08'`. Use mbCode (not basin name) for backend and map calls.

**`handleBasinBack` pattern** — Compute `willBeLevel` BEFORE dispatching (dispatch is synchronous, state changes immediately):
```ts
const willBeLevel = basinLevel === 'subbasin-l2' ? 'subbasin-l1'
                  : basinLevel === 'subbasin-l1' ? 'watershed' : null;
dispatch({ type: 'BACK' });
if (willBeLevel === 'subbasin-l1') fetchBasinData(...);
else if (willBeLevel === 'watershed') fetchBasinData(...);
```

**Tests** — `basin/__tests__/basinState.test.ts`, 92 tests. Run `npm test` from `frontend/` after any change to `basinState.ts` or basin handlers.

**Basin sidebar states (B1–B6)** — documented in `frontend/app/forecast/basin/BASIN_STATE_MACHINE.md`. L2 dropdown visibility: `(basinLevel==='subbasin-l1' && selectedL1 !== null) || (basinLevel==='subbasin-l2' && l2FilterSbCode !== null)`. "All micro basin" button always visible when `ENABLE_L2`; at watershed dispatches `DRILL_L2_FROM_WATERSHED`, elsewhere dispatches `DRILL_L2`. When selecting L2 from L1 view dispatch `SELECT_L2_FROM_PREVIEW` (not `SELECT_L2`).

## E2E Tests (Playwright)

Test files in `frontend/e2e/`. Target: `http://localhost:3000/forecast/yom` (dev server must be running).

**Backend must also be running** — e2e tests hit real API endpoints (dates, color data, detail rows). Start both natively: `make backend` (in one terminal/background) and `make frontend` (in another). `make e2e` does not start either server itself.

**Always use `make frontend`, never a raw `npm run dev`** — `make frontend` regenerates `frontend/.env.local` from the root `.env.local` (`grep '^NEXT_PUBLIC_' .env.local > frontend/.env.local`) before starting the dev server. If `frontend/.env.local` already exists from a previous run and you skip this step, `next dev` silently uses the stale file — new or changed `NEXT_PUBLIC_*` vars (e.g. a new feature flag) won't take effect and there's no error, just a feature that mysteriously doesn't render. Next.js does not hot-reload `NEXT_PUBLIC_*` env changes; a full dev-server restart is required after `frontend/.env.local` changes.

- `forecast.spec.ts` — map, overlays, opacity, admin nav, All Tambons (41 tests)
- `submode.spec.ts` — `sub` param correctness across admin/basin/model/mode changes (14 tests)
- `tableData.spec.ts` — table row count vs API, wb_level badge labels, column structure per mode, CSV export columns, EN/TH name values (9 tests)
- `rainfall.spec.ts` — rainfall mode button state, date picker restriction, table columns, CSV export, regression for other modes (15 tests)
- `basin-date-reset.spec.ts` — subbasin-l2 microbasin exemption, rainfall guard conflict resolution, no-change at current date (9 tests)

```bash
npm run test:e2e                              # run all tests headless
npm run test:e2e:ui                           # interactive Playwright UI
npx playwright test --grep "pattern"          # run subset
make e2e FILE=e2e/submode.spec.ts             # run one file via make
```

**Setup notes:**
- `window.__map` is exposed in `useMapInit.ts` after map load — tests query layer state via `map.getPaintProperty` / `map.getLayoutProperty`
- Tests force English locale via `localStorage.setItem('lang', 'en')` in `beforeEach`
- Key `data-testid` attributes: `viewmode-dropdown`, `viewmode-dropdown-option-{basin|admin}`, `date-dropdown`, `date-dropdown-option-{date}`, `model-dropdown`, `mode-dropdown`, `mode-dropdown-option-{drought|runoff|waterbalance}`, `submode-aggregate`, `submode-daily`, `export-csv-btn` (ProtoLayout sidebar), `side-table`, `table-row-{id}`

**Coverage:**
- Map load, basin/admin mode switch, date selection, date label preserved on mode switch
- Overlay toggles: rivers, hillshade, background (basemap-cover)
- Fill opacity reduces to 0.3 when rivers/hillshade active; restores to 0.8 when off
- Opacity persists through `applyColors` on drill-down (via `fillOpacityReducedRef`)
- `setDataFillOpacity` skips layers at opacity 0 so dismissed fills stay hidden
- Admin: province select/deselect with overlay active
- All Tambons: `adm3-line` filter uses `adm2_pcode` prefix slice (not `adm1_pcode`, which is absent in tambon PMTiles)
- All Tambons → select tambon: left panel shows correct province/amphoe/tambon with deselect buttons; tambon list is populated for the correct amphoe (covers both with-province and no-province entry paths)

## Overlay Layers

Toggleable via `OverlayToggle` component. All controlled through `setOverlayVisible` in `useMapInit.ts`.

- `adm1-overlay-casing` + `adm1-overlay` — province borders. Double-layer: white casing (3.5px) behind a dashed colored inner line (1.5px) for contrast on saturated fills. `setOverlayVisible` toggles both automatically via the `-casing` suffix convention.
- `adm2-overlay-casing` + `adm2-overlay` — amphoe borders, same casing pattern (2.5px / 0.8px).
- `ping-rivers` / `yom-rivers` — SWAT river network from `rivs.shp`. Only the current watershed's river layer is shown. Style in `theme.mapLine.river`.
- `hillshading` — terrain shading, all modes.
- `basemap-cover` — white background layer inserted between basemap style layers and data fills. Shown when "Background" is toggled OFF. Hillshading sits above it so terrain is still visible. Added before `adm1-fill` in init order.
- `{basin}-reservoir-small` / `-medium` / `-large` — reservoir point overlays from `{basin}-reservoir-{size}.pmtiles`. Three size tiers (S/M/L) toggled independently. Served via tileserver-gl.

Draw order: basemap style → basemap-cover → hillshading → data fills → overlay casings → overlay lines → highlight layers (moved to top via `map.moveLayer`).

**PMTiles** — tracked in git intentionally, regenerable via convert scripts. `frontend/public/downloads/` (SWAT zip files) is gitignored.

## PMTiles Sources & Field Conventions

Each PMTile source uses a different ID field convention — do not unify, they come from different upstream data formats.

| PMTiles file | Source | Layer name | ID field | Format | Notes |
|---|---|---|---|---|---|
| `{basin}-province.pmtiles` | `swat_data/{code}/03Province_Basin{code}` | `admin1` | `adm1_pcode` | `"TH63"` | Basin-scoped provinces |
| `{basin}-amphoe.pmtiles` | `swat_data/{code}/02Amphoe_Basin{code}` | `admin2` | `adm2_pcode` | `"TH5107"` | Also has `adm1_pcode` |
| `{basin}-tambon.pmtiles` | `swat_data/{code}/01Tambol_Basin{code}` | `admin3` | `adm3_pcode` | `"TH500101"` | Has `adm2_pcode`, **no** `adm1_pcode` |
| `tha-province.pmtiles` | national Thailand data | `admin1` | `adm1_pcode` | `"TH63"` | Overlay only (full Thailand) |
| `tha-amphoe.pmtiles` | national Thailand data | `admin2` | `adm2_pcode` | `"TH5107"` | Overlay only (full Thailand) |
| `{basin}-watershed.pmtiles` | `swat_data/{code}/Basin{code}_bonwr` | `basin-watershed` | `MB_CODE` | `"06"` | Single polygon per basin |
| `{basin}-subbasin-l1.pmtiles` | `Swat_Results/map/{basin} real sub` | `{basin}-subbasin-l1` | `SB_CODE` | `"0601"` | |
| `{basin}-subbasin-l2.pmtiles` | `Swat_Results/Month/{Basin}/TablesOut/subs.shp` | `{basin}-subbasin-l2` | `Subbasin` | `4` (integer) | Only field requiring `parseInt` |
| `{basin}-reservoir-small.pmtiles` | reservoir shapefile | `{basin}-reservoir-small` | — | — | Small reservoir points |
| `{basin}-reservoir-medium.pmtiles` | reservoir shapefile | `{basin}-reservoir-medium` | — | — | Medium reservoir points |
| `{basin}-reservoir-large.pmtiles` | reservoir shapefile | `{basin}-reservoir-large` | — | — | Large reservoir points |

**"TH" prefix** — `adm*_pcode` fields store the prefix in the PMTiles. `buildMatchExpr` in `useMapInit.ts` prepends `TH` to backend IDs before building the match expression. Do not strip this convention.

**Admin URLs are watershed-derived** — `useMapInit` computes `/thaimap/${watershed}-province.pmtiles` etc. at render time from the `watershed` param. The old `NEXT_PUBLIC_PMTILES_ADM*_URL` env vars are removed.

**Regeneration scripts:**
- Admin basin PMTiles: `python3 scripts/convert-admin-basin-shapefiles.py`
- Basin/watershed PMTiles: `python3 scripts/convert-basin-shapefiles.py`
- River PMTiles: `python3 scripts/convert-river-shapefiles.py`

## SideTable

- Table element: `minWidth: '100%'` — NOT `width: '100%'`. Using `width: 100%` caps `scrollWidth`, breaking horizontal scroll to rightmost columns.
- Scroll container (`overflowX: auto`) is `flex: 1` in SideTable's flex column — height from flex chain, not content.
- SideTable root: `overflow: hidden`. Inner scroll div: `overflow: auto`. Do not swap.

**Column order (non-rainfall modes):** primary index · wb_level · secondary index · water_demand · watersupply · [rainfall] · reservoir
- waterbalance: `wb_level, drought_index, runoff_index, ...`
- drought:      `drought_index, wb_level, runoff_index, ...`
- runoff:       `runoff_index, wb_level, drought_index, ...`

`rainfall(mm)` column is shown only when `showRainfall=true` (current/future date, or at subbasin-l2). Hidden for past dates at all other levels.

**Rainfall mode columns (distinct layout):** name · rainfall_index · rainfall(mm) · water_demand · watersupply · reservoir — no wb_level/drought/runoff columns.

`rainfallToIndex(mm)` in `theme.ts` maps raw mm to a 0–6 index. `IndexBadge` renders the colored badge per row.

**Default sort per mode:** waterbalance → `wb_level desc` · runoff → `runoff_index desc` · drought → `drought_index desc` · rainfall → `rainfall mm desc`. Switching mode resets sort via `useEffect`.

**wb_level badge** — `wbLevelToBucket(v)` = `Math.min(6, Math.max(0, Math.round(v)))`. DB stores 0–6 in a NUMERIC column (pg returns as JS string); `Math.round` coerces correctly. Labels in `t.legend.wb0`–`wb6`. Do NOT treat wb_level as a percentage — it is a pre-computed severity bucket relative to each subbasin's water demand ratio, NOT derived from raw `water_balance` alone.

**`hideToolbar` prop** — ProtoLayout always passes `hideToolbar` to SideTable, so the SideTable export button is never rendered there. The accessible export is `handleExportCsv` in ProtoLayout (sidebar IconBtn, `data-testid="export-csv-btn"`).

## CSV Export (ProtoLayout)

`handleExportCsv` in `ProtoLayout.tsx` — mode-independent fixed column order:

`Code · Name EN · Name TH · wb_level · drought_index · runoff_index · water_demand · watersupply · rainfall · reservoir`

Code column: `TH{id}` for admin mode (matches shapefile `adm*_pcode`), raw `id` for basin mode (matches `MB_CODE` / `SB_CODE` / `Subbasin`).

Filename: `water-{date}-{admin|basin}-{week|month}-{weekly|monthly|daily}-{EN|TH}.csv`
- 6months + aggregate → date as `YYYY-MM`; all other cases → full `YYYY-MM-DD`
- Guards `if (!selectedDate) return` — no export when no date is loaded

**wb_level vs water_balance** — `water_balance` is the raw SWAT MCM float (not exported). `wb_level` is the 0–6 severity bucket (exported). They are different DB columns.

## DB Type Note

PostgreSQL NUMERIC columns (`wb_level`, `rainfall`, `watersupply`, `water_demand`, `water_balance`, `reservoir`) are returned as **JS strings** by the `pg` library. Frontend uses `Number()` / `Math.round()` coercion — works correctly but the Row type declares `number` which is technically wrong at runtime. `drought_index` and `runoff_index` are INTEGER → returned as JS numbers.

## Rainfall Mode

Rainfall is a 4th data mode (`mode === 'rainfall'`). Its rules differ from the other three:

**Date visibility rule** — current or future dates only (no historical data makes sense for rainfall forecasts):
- `isPastDate`: `selectedDate < _today` (7days) or `selectedDate.slice(0,7) < _currentMonth` (6months)
- `showRainfall`: `isAtMicrobasin || !isPastDate` — controls whether the `rainfall(mm)` column is shown in SideTable
- `rainfallDateOptions`: `allDateOptions` filtered to `>= today` / `>= currentMonth`, OR all dates if at microbasin
- `rainfallDisabled`: `rainfallDateOptions.length === 0 || !rainfallDateOptions.some(o => o.value === selectedDate)` — disables the mode button

**Microbasin exemption** — at `basinLevel === 'subbasin-l2'` (subbasin-l2), all dates are valid for rainfall mode. `isAtMicrobasin = viewMode === 'basin' && basinLevel === 'subbasin-l2'`.

**Rainfall guard** (`ENABLE_RAINFALL_GUARD`, default `true`) — single `useEffect` that watches `[mode, selectedDate, viewMode, basinLevel, model, subMode, availableDates]`:
- Fires when: rainfall mode + past date + NOT at microbasin
- Resolution: reset `selectedDate` to current date/month (stay in rainfall) if current date exists in DB
- Fallback: switch to `waterbalance` mode with default date if no current date exists
- Disabled via `NEXT_PUBLIC_RAINFALL_GUARD=false` — guard returns early, no auto-fix

This guard replaces scattered handler-based patches — `handleModeChange` and `handleBasinBack` are simple originals with no date-reset logic.

**Key testIds**: `mode-dropdown-option-rainfall`, `rainfall-index-badge` (IndexBadge in each row), `drill-l2-btn` (navigate to subbasin-l2).

## Collaboration Rules

- Ask for clarification before proceeding if a request is unclear.
- **Stop reading when you have enough to reason.** Read the directly relevant files, identify the issue, explain it. Do not keep reading unrelated files to build certainty.
- **Standard patterns** (CSS flex/scroll bugs, React patterns) need 1–2 files to diagnose. Read the minimum, then reason.
- **Answer first, then ask** — state the likely cause concisely, ask if the user wants the fix.
