# Basin Navigation State Machine

Source of truth for all basin navigation behavior.
Implementation lives in `basinState.ts` (reducer), `BasinSidebar.tsx` (left panel), and layout files (side effects).

---

## State Fields

| Field | Type | Meaning |
|---|---|---|
| `basinLevel` | `'watershed' \| 'subbasin-l1' \| 'subbasin-l2'` | Current depth |
| `selectedL1` | `string \| null` | Selected L1 sbCode (e.g. `'0601'`) |
| `selectedL2` | `string \| null` | Selected L2 subbasin ID |
| `l2FilterSbCode` | `string \| null` | Which L1's L2s are shown; null = all L2s visible, no dropdown |
| `l2EntryFromWatershed` | `boolean` | True when reached L2 directly from watershed — BACK returns to watershed, not L1 |

Feature flag `ENABLE_L2` gates all L2 states, the L2 dropdown, and the "All micro basin" button.

---

## Left Panel Rules

- **Watershed row**: always shown
- **L1 dropdown**: shown when `basinLevel !== 'watershed'`
- **L2 dropdown**: shown when `ENABLE_L2 && ((basinLevel === 'subbasin-l1' && selectedL1 !== null) || (basinLevel === 'subbasin-l2' && l2FilterSbCode !== null))`
- **"All micro basin" button**: always shown when `ENABLE_L2` (all states)

---

## States

### B1 — Watershed
`basinLevel='watershed'`

**Left panel:** Watershed row · L1 drill-btn · "All micro basin" btn

| Action | Trigger | Next |
|---|---|---|
| Click L1 drill-btn | sidebar | B2 |
| Click "All micro basin" btn | sidebar | B5 (`l2EntryFromWatershed=true`) |
| Click watershed polygon | map | B2 |

---

### B2 — L1 Overview *(default on load)*
`basinLevel='subbasin-l1'`, `selectedL1=null`

**Left panel:** Watershed row · L1 dropdown (empty) · "All micro basin" btn

| Action | Trigger | Next |
|---|---|---|
| Click L1 polygon / dropdown item | map / sidebar | B3 |
| Click × on L1 dropdown | sidebar | B1 |
| Click "All micro basin" btn | sidebar | B5 |

---

### B3 — L1 Selected
`basinLevel='subbasin-l1'`, `selectedL1='XXXX'`

**Left panel:** Watershed row · L1 dropdown (selected) · L2 dropdown (items for this L1) · "All micro basin" btn

| Action | Trigger | Next |
|---|---|---|
| Click × on L1 dropdown | sidebar | B2 |
| Click different L1 | map / sidebar | B3 (new L1) |
| Re-click same L1 on map | map | B4 |
| Select L2 from dropdown | sidebar | B4 (via `SELECT_L2_FROM_PREVIEW`) |
| Click "All micro basin" btn | sidebar | B5 |

---

### B4 — L2 Filtered (drilled from specific L1)
`basinLevel='subbasin-l2'`, `selectedL1='XXXX'`, `l2FilterSbCode='XXXX'`, `l2EntryFromWatershed=false`

Only L2s belonging to the selected L1 are colored. `selectedL2` may be null or set.

**Left panel:** Watershed row · L1 dropdown (selected) · L2 dropdown (filtered to L1) · "All micro basin" btn

| Action | Trigger | Next |
|---|---|---|
| Click / select L2 | map / sidebar | B4 (selectedL2 set) |
| Click × on L2 dropdown (no L2 selected) | sidebar | B3 |
| Click × on L1 dropdown | sidebar | B2 |
| Click "All micro basin" btn | sidebar | B5 |

---

### B5 — L2 All (from "All micro basin" or watershed)
`basinLevel='subbasin-l2'`, `l2FilterSbCode=null`

All L2 polygons colored. `l2EntryFromWatershed` determines BACK target.

**Left panel:** Watershed row · L1 dropdown (shown if `selectedL1` set) · NO L2 dropdown · "All micro basin" btn

| Action | Trigger | Next |
|---|---|---|
| Click L2 polygon on map | map | B5 (selectedL2 set, no dropdown) |
| Click × on L1 dropdown | sidebar | B2 |
| BACK (× / map empty click) | sidebar | B3 if `selectedL1` set, else B2, or B1 if `l2EntryFromWatershed` |

---

## Action → State Transition Summary

| Action | `basinLevel` | `selectedL1` | `l2FilterSbCode` | `l2EntryFromWatershed` |
|---|---|---|---|---|
| `DRILL_TO_L1` | `subbasin-l1` | null | — | — |
| `SELECT_L1` | `subbasin-l1` | set | — | — |
| `DRILL_L2_FROM_L1` | `subbasin-l2` | preserved | = sbCode | false |
| `SELECT_L2_FROM_PREVIEW` | `subbasin-l2` | preserved | = selectedL1 | false |
| `DRILL_L2` | `subbasin-l2` | preserved | null | false |
| `DRILL_L2_FROM_WATERSHED` | `subbasin-l2` | null | null | true |
| `SELECT_L2` | preserved | preserved | preserved | preserved |
| `BACK` from L2 (filtered) | `subbasin-l1` | preserved | null | false |
| `BACK` from L2 (watershed) | `watershed` | null | null | false |
| `BACK` from L2 (unfiltered, not watershed) | `subbasin-l1` | preserved | null | false |
| `BACK` from L1 | `watershed` | null | — | — |
| `RESET` | `subbasin-l1` | null | null | false |

---

## Map Click Handler Guards

- Empty map click at B4/B5: dispatch `BACK`
- Re-click same L1 at B3: dispatch `DRILL_L2_FROM_L1` (second-click drills to filtered L2)
- Re-click same L2: no-op

## "All micro basin" Button Handler

At `basinLevel='watershed'`: dispatch `DRILL_L2_FROM_WATERSHED` (so BACK returns to watershed).  
At all other levels: dispatch `DRILL_L2` (so BACK returns to L1).
