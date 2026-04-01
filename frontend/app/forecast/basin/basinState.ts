/**
 * Pure basin navigation state machine.
 *
 * No React, no MapLibre. Takes current state + action, returns next state.
 * Map layer calls and camera animations are side effects handled by the caller.
 *
 * Every handler in ForecastMap.tsx that modifies basin state should have an
 * equivalent transition here. Tests verify this file; the reducer refactor will
 * replace the handlers with useReducer(basinReducer, initialBasinState).
 */

export type Basin = 'ping' | 'yom';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';

export type BasinState = {
  basinLevel: BasinLevel;
  selectedBasin: Basin | null;
  selectedL1: string | null;
  selectedL2: string | null;
  l2FilterSbCode: string | null;
  l2EntryFromWatershed: boolean;
};

export type BasinAction =
  | { type: 'SELECT_BASIN'; basin: Basin }       // click basin in sidebar or map
  | { type: 'SELECT_L1'; sbCode: string }        // click L1 item
  | { type: 'DRILL_L2_FROM_L1'; sbCode: string } // second-click selected L1
  | { type: 'DRILL_L2' }                         // "Sub-basins L2 →" footer button from L1
  | { type: 'DRILL_L2_FROM_WATERSHED' }          // "Sub-basins L2 (all) →" footer from watershed
  | { type: 'SELECT_L2'; subbasinId: string }    // click L2 item
  | { type: 'SELECT_L2_FROM_PREVIEW'; subbasinId: string } // click L2 preview item from L1 view
  | { type: 'BACK' }                             // × button or click outside at any level
  | { type: 'RESET' };                           // switch away from basin mode

export const initialBasinState: BasinState = {
  basinLevel: 'watershed',
  selectedBasin: null,
  selectedL1: null,
  selectedL2: null,
  l2FilterSbCode: null,
  l2EntryFromWatershed: false,
};

export function basinReducer(state: BasinState, action: BasinAction): BasinState {
  switch (action.type) {

    case 'SELECT_BASIN': {
      if (state.selectedBasin === action.basin && state.basinLevel === 'watershed') {
        // Second click on already-selected basin → drill to L1
        return { ...state, basinLevel: 'subbasin-l1', selectedL1: null };
      }
      // First click (or switching basins) → select, stay at watershed
      return { ...state, selectedBasin: action.basin };
    }

    case 'SELECT_L1': {
      // Select an L1 sub-basin — stays at subbasin-l1 level
      return { ...state, selectedL1: action.sbCode };
    }

    case 'DRILL_L2_FROM_L1': {
      // Second click on already-selected L1 → drill to L2 filtered to that L1
      return {
        ...state,
        basinLevel: 'subbasin-l2',
        selectedL2: null,
        l2FilterSbCode: action.sbCode,
        l2EntryFromWatershed: false,
      };
    }

    case 'DRILL_L2': {
      // "Sub-basins L2 →" footer button from L1 → L2 view showing all L2s for the basin
      return {
        ...state,
        basinLevel: 'subbasin-l2',
        selectedL2: null,
        l2FilterSbCode: null,
        l2EntryFromWatershed: false,
      };
    }

    case 'DRILL_L2_FROM_WATERSHED': {
      // "Sub-basins L2 (all) →" footer from watershed → skip L1, show all L2s
      return {
        ...state,
        basinLevel: 'subbasin-l2',
        selectedL1: null,
        selectedL2: null,
        l2FilterSbCode: null,
        l2EntryFromWatershed: true,
      };
    }

    case 'SELECT_L2': {
      return { ...state, selectedL2: action.subbasinId };
    }

    case 'SELECT_L2_FROM_PREVIEW': {
      // Click L2 preview item from L1 view → drill to L2 with L2 pre-selected
      return {
        ...state,
        basinLevel: 'subbasin-l2',
        selectedL2: action.subbasinId,
        l2FilterSbCode: state.selectedL1,
        l2EntryFromWatershed: false,
      };
    }

    case 'BACK': {
      if (state.basinLevel === 'subbasin-l2') {
        if (state.l2EntryFromWatershed) {
          return {
            ...state,
            basinLevel: 'watershed',
            selectedL1: null,
            selectedL2: null,
            l2FilterSbCode: null,
            l2EntryFromWatershed: false,
          };
        }
        return {
          ...state,
          basinLevel: 'subbasin-l1',
          selectedL2: null,
          l2FilterSbCode: null,
          l2EntryFromWatershed: false,
        };
      }
      if (state.basinLevel === 'subbasin-l1') {
        return {
          ...state,
          basinLevel: 'watershed',
          selectedBasin: null,
          selectedL1: null,
        };
      }
      if (state.basinLevel === 'watershed' && state.selectedBasin) {
        // Deselect basin without changing level
        return { ...state, selectedBasin: null };
      }
      return state;
    }

    case 'RESET': {
      return initialBasinState;
    }
  }
}
