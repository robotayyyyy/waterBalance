# Basin Navigation State Machine

Source of truth for all basin navigation behavior.
Implementation lives in `basinState.ts` (reducer) and `ProtoLayout.tsx` (side effects).

---

## State Fields

| Field | Type | Meaning |
|---|---|---|
| `basinLevel` | `'watershed' \| 'subbasin-l1' \| 'subbasin-l2'` | Current depth |
| `selectedL1` | `string \| null` | Selected L1 sbCode (e.g. `'0601'`) |
| `selectedL2` | `string \| null` | Selected L2 subbasin ID |
| `l2FilterSbCode` | `string \| null` | Which L1's L2s to show on map; null = show all |
| `l2EntryFromWatershed` | `boolean` | True if reached L2 directly from watershed (affects BACK target) |

Feature flags: `ENABLE_L2` gates all L2 states and actions.

---

## States

### S1 — Watershed
`basinLevel='watershed'`, `selectedL1=null`, `selectedL2=null`

**Left panel shows:**
- Watershed dropdown (single item, current basin)
- "Subbasin L1 →" drill button
- "Subbasin L2 →" drill button *(if ENABLE_L2)*

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click watershed polygon on map | map click | S2 |
| Click "Subbasin L1 →" button | sidebar | S2 |
| Click "Subbasin L2 →" button | sidebar | S4-all *(if ENABLE_L2)* |
| Switch basin (watershed dropdown) | sidebar | S2 (new basin) |

---

### S2 — L1 Overview *(default on page load)*
`basinLevel='subbasin-l1'`, `selectedL1=null`, `selectedL2=null`

All L1 polygons colored. No L1 highlighted.

**Left panel shows:**
- Watershed dropdown
- L1 dropdown (no selection, list of all L1s)
- "Subbasin L2 →" drill button *(if ENABLE_L2)*

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click L1 polygon on map | map click | S3 |
| Click L1 in dropdown | sidebar | S3 |
| Click L1 row in table | table | S3 |
| Click × on L1 dropdown (back) | sidebar | S1 |
| Click "Subbasin L2 →" button | sidebar | S4-all *(if ENABLE_L2)* |
| Switch basin | sidebar | S2 (new basin) |

---

### S3 — L1 Selected
`basinLevel='subbasin-l1'`, `selectedL1='XXXX'`, `selectedL2=null`

Selected L1 highlighted. Map zoomed to L1 bbox.

**Left panel shows:**
- Watershed dropdown
- L1 dropdown (L1 selected, × deselect button)
- L2 preview list (inline list of L2 items belonging to this L1, with color dots) *(if ENABLE_L2)*
- "Subbasin L2 →" drill button *(if ENABLE_L2)*

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click × on L1 dropdown | sidebar | S2 |
| Click different L1 on map | map click | S3 (new L1) |
| Click different L1 in dropdown | sidebar | S3 (new L1) |
| Re-click same L1 on map | map click | S4-filtered |
| Click item in L2 preview list | sidebar | S5 *(if ENABLE_L2)* |
| Click "Subbasin L2 →" button | sidebar | S4-filtered *(if ENABLE_L2)* |
| Switch basin | sidebar | S2 (new basin) |

---

### S4-all — L2 Overview (all L2, no L1 filter)
`basinLevel='subbasin-l2'`, `selectedL1=null OR selectedL1='XXXX'`, `selectedL2=null`, `l2FilterSbCode=null`, `l2EntryFromWatershed=true/false`

All L2 polygons colored. No L2 highlighted.

**Left panel shows:**
- Watershed dropdown
- L1 dropdown *(if selectedL1 set)*
- L2 dropdown (no selection, list of all L2s)

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click L2 polygon on map | map click | S5 |
| Click L2 in dropdown | sidebar | S5 |
| Click L2 row in table | table | S5 |
| Click × on L2 dropdown (back) | sidebar | S1 *(if l2EntryFromWatershed)* or S2 |
| Switch basin | sidebar | S2 (new basin) |

---

### S4-filtered — L2 Overview (filtered to one L1)
`basinLevel='subbasin-l2'`, `selectedL1='XXXX'`, `selectedL2=null`, `l2FilterSbCode='XXXX'`, `l2EntryFromWatershed=false`

Only L2s belonging to the selected L1 are colored.

**Left panel shows:**
- Watershed dropdown
- L1 dropdown (L1 selected, × deselect button)
- L2 dropdown (no selection, list filtered to this L1's L2s)

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click L2 polygon on map | map click | S5 |
| Click L2 in dropdown | sidebar | S5 |
| Click L2 row in table | table | S5 |
| Click × on L2 dropdown (back) | sidebar | S3 |
| Click × on L1 dropdown | sidebar | S2 |
| Switch basin | sidebar | S2 (new basin) |

---

### S5 — L2 Selected
`basinLevel='subbasin-l2'`, `selectedL2='YYY'`, `l2FilterSbCode='XXXX' or null`

One L2 highlighted. Map zoomed to L2 bbox.

**Left panel shows:**
- Watershed dropdown
- L1 dropdown *(if selectedL1 set)*
- L2 dropdown (L2 selected, × deselect button)

**Possible actions:**

| Action | Trigger | Next state |
|---|---|---|
| Click different L2 on map | map click | S5 (new L2) |
| Click different L2 in dropdown | sidebar | S5 (new L2) |
| Click × on L2 dropdown (back) | sidebar | S4-filtered *(if l2FilterSbCode set)*, else S4-all |
| Click × on L1 dropdown | sidebar | S2 |
| Switch basin | sidebar | S2 (new basin) |

---

## Open Questions

1. **L2 preview list** (currently in S3): should it exist? If yes, clicking an item goes to S5. If no, remove and rely solely on the drill button.
2. **"Subbasin L2 →" from S2** (no L1 selected): should it go to S4-all or be hidden?
3. **BACK from S4-filtered**: currently goes to S3 (L1 selected). Is this correct?
