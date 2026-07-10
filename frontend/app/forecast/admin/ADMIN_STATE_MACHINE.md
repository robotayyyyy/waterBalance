# Admin Navigation State Machine

Source of truth for all admin mode navigation behavior.
Implementation lives in `adminState.ts` (reducer) and `useSelectionHandlers.ts` (side effects).

---

## State Fields

| Field | Type | Meaning |
|---|---|---|
| `activeLevel` | `'province' \| 'amphoe' \| 'tambon'` | Controls what map clicks do |
| `selectedProvince` | `string` | Selected province ID e.g. `'63'`; empty = none |
| `selectedAmphoe` | `string` | Selected amphoe ID e.g. `'6301'`; empty = none |
| `selectedTambon` | `string` | Selected tambon ID e.g. `'630101'`; empty = none |
| `entryFromAllTambon` | `boolean` | True when tambon level was entered via "All Tambons" button; controls DESELECT_TAMBON target |

**Left panel visibility rules** (from `ProvinceSelector`):
- Amphoe dropdown: visible when `selectedProvince != ''`
- Tambon dropdown: visible when `selectedAmphoe != ''`
- Amphoe × button: visible when `selectedAmphoe != ''`
- Tambon × button: visible when `selectedTambon != ''`
- "All Tambons" button: always visible when `viewMode='admin'`
- "All Amphoe" button: always visible when `viewMode='admin'`

Tambon drill-down (states A5, A6, A7) and the All Tambons / All Amphoe buttons are always
enabled (no feature flag).

---

## States

### A1 — Province Overview *(default)*
`activeLevel='province'`, `selectedProvince=''`, `selectedAmphoe=''`, `selectedTambon=''`, `entryFromAllTambon=false`

All provinces colored. No province highlighted. Map at basin initial view.

**Left panel:** Province dropdown (no selection). No amphoe/tambon dropdowns.

| Action | Trigger | Next state |
|---|---|---|
| Click province on map | map | A3 |
| Select province in dropdown | sidebar | A3 |
| Click province row in table | table | A3 |
| Click "All Tambons" | sidebar | A6-no-filter |
| Click empty map area | map | A1 (no-op) |

---

### A2 — Province Focused
`activeLevel='province'`, `selectedProvince='XX'`, `selectedAmphoe=''`, `selectedTambon=''`, `entryFromAllTambon=false`

Reached only via amphoe deselect. Province still selected and highlighted. Map at province bbox. Province-level colors shown.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (no selection, × hidden).

| Action | Trigger | Next state |
|---|---|---|
| Click same province on map | map | A3 |
| Click different province on map | map | A3 (new province) |
| Click empty map area | map | A1 |
| Click × on province | sidebar | A1 |
| Select province in dropdown | sidebar | A3 |
| Select amphoe in dropdown | sidebar | A4 |
| Click province row in table | table | A3 |
| Click amphoe row in table | table | A4 |
| Click "All Tambons" | sidebar | A6-province-filter |

---

### A3 — Amphoe Overview
`activeLevel='amphoe'`, `selectedProvince='XX'`, `selectedAmphoe=''`, `selectedTambon=''`, `entryFromAllTambon=false`

Province highlighted. All amphoes in province colored. No amphoe highlighted. Map at province bbox.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (no selection, × hidden).

| Action | Trigger | Next state |
|---|---|---|
| Click amphoe on map | map | A4 |
| Select amphoe in dropdown | sidebar | A4 |
| Click amphoe row in table | table | A4 |
| Click empty map area | map | A2 |
| Click × on province | sidebar | A1 |
| Select different province in dropdown | sidebar | A3 (new province) |
| Click "All Tambons" | sidebar | A6-province-filter |

---

### A4 — Amphoe Selected
`activeLevel='amphoe'`, `selectedProvince='XX'`, `selectedAmphoe='XXXX'`, `selectedTambon=''`, `entryFromAllTambon=false`

Province + amphoe highlighted. Map zoomed to amphoe bbox. Tambon colors prefetched in background.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (selected, ×). No tambon dropdown.

| Action | Trigger | Next state |
|---|---|---|
| Re-click same amphoe on map | map | A5 |
| Click different amphoe on map | map | A4 (new amphoe) |
| Select different amphoe in dropdown | sidebar | A4 (new amphoe) |
| Click empty map area | map | A2 |
| Click × on amphoe | sidebar | A2 |
| Click × on province | sidebar | A1 |
| Click amphoe row in table | table | A4 (new) or no-op (same) |
| Click "All Tambons" | sidebar | A6-province-filter |

---

### A5 — Tambon Overview (filtered to amphoe)
`activeLevel='tambon'`, `selectedProvince='XX'`, `selectedAmphoe='XXXX'`, `selectedTambon=''`, `entryFromAllTambon=false`

Only tambons in the selected amphoe shown and colored. No tambon highlighted.
Reached via re-clicking the selected amphoe on map.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (selected, ×). Tambon dropdown (no selection).

| Action | Trigger | Next state |
|---|---|---|
| Click tambon on map | map | A7 (`entryFromAllTambon=false`) |
| Select tambon in dropdown | sidebar | A7 (`entryFromAllTambon=false`) |
| Click tambon row in table | table | A7 (`entryFromAllTambon=false`) |
| Click empty map area | map | A4 (map zooms to amphoe bbox) |
| Click × on amphoe | sidebar | A2 |
| Click × on province | sidebar | A1 |
| Click "All Tambons" | sidebar | A6-province-filter |

---

### A6-province-filter — All Tambons (province)
`activeLevel='tambon'`, `selectedProvince='XX'`, `selectedAmphoe=''`, `selectedTambon=''`, `entryFromAllTambon=true`

All tambons in the province shown and colored. Map at province bbox.

**Map entry requirement:** `handleDrillToAllTambon` must explicitly set `adm3-fill` fill-opacity to `getFillOpacity()` on entry — it is 0 when arriving from A4 for the first time (before any tambon fetch). Not setting it leaves tambons invisible until `applyColors` fires.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (no selection, × hidden). No tambon dropdown.

| Action | Trigger | Next state |
|---|---|---|
| Click tambon on map | map | A7 (`entryFromAllTambon=true`) |
| Click tambon row in table | table | A7 (`entryFromAllTambon=true`) |
| Click empty map area | map | A3 (dismiss All Tambons → amphoe overview, map fits to province bbox) |
| Click × on province | sidebar | A1 |
| Click "All Tambons" | sidebar | A6-province-filter (no-op) |

---

### A6-no-filter — All Tambons (basin)
`activeLevel='tambon'`, `selectedProvince=''`, `selectedAmphoe=''`, `selectedTambon=''`, `entryFromAllTambon=true`

All tambons in the basin shown and colored. No province filter. Map at basin initial view.

**Map entry requirement:** Same fill-opacity requirement as A6-province-filter.

**Left panel:** Province dropdown (no selection). No amphoe/tambon dropdowns.

| Action | Trigger | Next state |
|---|---|---|
| Click tambon on map | map | A7 (`entryFromAllTambon=true`, province derived from tambon ID) |
| Click tambon row in table | table | A7 (`entryFromAllTambon=true`, province derived from tambon ID) |
| Click empty map area | map | A1 (dismiss All Tambons → full reset, map flies to basin view) |
| Click "All Tambons" | sidebar | A6-no-filter (no-op) |

---

### A7 — Tambon Selected
`activeLevel='tambon'`, `selectedProvince='XX'`, `selectedAmphoe='XXXX'`, `selectedTambon='XXXXXX'`, `entryFromAllTambon=true or false`

Tambon highlighted. Map zoomed to amphoe bbox.

**Left panel:** Province dropdown (selected, ×). Amphoe dropdown (selected, ×). Tambon dropdown (selected, ×).

| Action | Trigger | `entryFromAllTambon=false` → | `entryFromAllTambon=true` → |
|---|---|---|---|
| Click × on tambon | sidebar | A4 (map zooms to amphoe bbox) | A6-province-filter (map zooms to province bbox) |
| Click empty map area | map | A4 (map zooms to amphoe bbox) | A6-province-filter (map zooms to province bbox) |
| Re-click same tambon on map | map | A7 (**no-op** — guard must skip `handleTambonSelect`) | A7 (**no-op** — guard must skip `handleTambonSelect`) |
| Click different tambon on map | map | A7 (new tambon) | A7 (new tambon, `entryFromAllTambon` preserved) |
| Select different tambon in dropdown | sidebar | A7 (new tambon) | A7 (new tambon, `entryFromAllTambon` preserved) |
| Click tambon row in table | table | A7 (new) or no-op (same) | A7 (new) or no-op (same) |
| Click × on amphoe | sidebar | A2 | A2 (`entryFromAllTambon=false`) |
| Click × on province | sidebar | A1 | A1 |
| Click "All Tambons" | sidebar | A6-province-filter | A6-province-filter |

---

## Map Click Handler Guards

The onClick `useEffect` in each layout file must enforce these guards before calling handlers. Guards prevent actions that the state machine defines as no-ops.

**At `activeLevel='tambon'`, no feature hit (empty click):**
```
→ handleTambonDeselect() always
  inside: if selectedTambon === '' AND entryFromAllTambon === true
            → dismiss All Tambons: SELECT_PROVINCE(selectedProvince) → A3, or DESELECT_PROVINCE → A1
          else
            → normal deselect path (A4 or A6)
```
Guard lives inside `handleTambonDeselect` (needs `selectedTambon` in its closure/deps).

**At `activeLevel='tambon'`, feature hit:**
```
if id === selectedTambon → no-op (stay in A7, skip redundant fetch)
else → handleTambonSelect(id)
```
Guard lives in the onClick handler (needs `selectedTambon` in the effect closure/deps).

---

## Action → State Transition Summary

| Action | `entryFromAllTambon` result |
|---|---|
| `DRILL_TO_ALL_TAMBON` | `true` |
| `SELECT_TAMBON` | preserved from current state |
| `DESELECT_TAMBON` (was `false`) | `false` → goes to A4 |
| `DESELECT_TAMBON` (was `true`) | `true` → goes to A6 |
| `DESELECT_AMPHOE` | `false` |
| `SELECT_PROVINCE`, `DESELECT_PROVINCE`, `SELECT_AMPHOE`, `DRILL_TO_TAMBON`, `RESET` | `false` |
