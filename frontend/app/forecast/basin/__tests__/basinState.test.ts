import { describe, it, expect } from 'vitest';
import { basinReducer, initialBasinState } from '../basinState';
import type { BasinState } from '../basinState';

// Helper: apply a sequence of actions from a given starting state
function apply(state: BasinState, ...actions: Parameters<typeof basinReducer>[1][]): BasinState {
  return actions.reduce((s, a) => basinReducer(s, a), state);
}

const init = initialBasinState;

// ─── Watershed level ──────────────────────────────────────────────────────────

describe('Watershed level', () => {
  it('first click on an unselected basin selects it and stays at watershed', () => {
    const next = basinReducer(init, { type: 'SELECT_BASIN', basin: 'ping' });
    expect(next.selectedBasin).toBe('ping');
    expect(next.basinLevel).toBe('watershed');
  });

  it('first click selects basin without touching L1/L2 state', () => {
    const next = basinReducer(init, { type: 'SELECT_BASIN', basin: 'yom' });
    expect(next.selectedL1).toBeNull();
    expect(next.selectedL2).toBeNull();
    expect(next.l2FilterSbCode).toBeNull();
  });

  it('second click on the already-selected basin drills to subbasin-l1', () => {
    const withPing: BasinState = { ...init, selectedBasin: 'ping', basinLevel: 'watershed' };
    const next = basinReducer(withPing, { type: 'SELECT_BASIN', basin: 'ping' });
    expect(next.basinLevel).toBe('subbasin-l1');
    expect(next.selectedBasin).toBe('ping');
    expect(next.selectedL1).toBeNull();
  });

  it('clicking a different basin while one is selected switches selection and stays at watershed', () => {
    const withPing: BasinState = { ...init, selectedBasin: 'ping' };
    const next = basinReducer(withPing, { type: 'SELECT_BASIN', basin: 'yom' });
    expect(next.selectedBasin).toBe('yom');
    expect(next.basinLevel).toBe('watershed');
  });

  it('BACK with a selected basin deselects it without changing level', () => {
    const withPing: BasinState = { ...init, selectedBasin: 'ping' };
    const next = basinReducer(withPing, { type: 'BACK' });
    expect(next.selectedBasin).toBeNull();
    expect(next.basinLevel).toBe('watershed');
  });

  it('BACK with no selected basin is a no-op', () => {
    const next = basinReducer(init, { type: 'BACK' });
    expect(next).toEqual(init);
  });
});

// ─── Sub-basin L1 level ───────────────────────────────────────────────────────

describe('Sub-basin L1 level', () => {
  const atL1: BasinState = {
    ...init,
    basinLevel: 'subbasin-l1',
    selectedBasin: 'ping',
    selectedL1: null,
  };

  it('selecting an L1 item sets selectedL1 and stays at subbasin-l1', () => {
    const next = basinReducer(atL1, { type: 'SELECT_L1', sbCode: 'P01' });
    expect(next.selectedL1).toBe('P01');
    expect(next.basinLevel).toBe('subbasin-l1');
  });

  it('selecting a different L1 updates selectedL1', () => {
    const withL1: BasinState = { ...atL1, selectedL1: 'P01' };
    const next = basinReducer(withL1, { type: 'SELECT_L1', sbCode: 'P02' });
    expect(next.selectedL1).toBe('P02');
  });

  it('DRILL_L2_FROM_L1 drills to subbasin-l2 filtered to that L1', () => {
    const withL1: BasinState = { ...atL1, selectedL1: 'P01' };
    const next = basinReducer(withL1, { type: 'DRILL_L2_FROM_L1', sbCode: 'P01' });
    expect(next.basinLevel).toBe('subbasin-l2');
    expect(next.l2FilterSbCode).toBe('P01');
    expect(next.selectedL2).toBeNull();
  });

  it('DRILL_L2 (footer button) drills to subbasin-l2 with no L1 filter', () => {
    const next = basinReducer(atL1, { type: 'DRILL_L2' });
    expect(next.basinLevel).toBe('subbasin-l2');
    expect(next.l2FilterSbCode).toBeNull();
    expect(next.selectedL2).toBeNull();
  });

  it('clicking L2 preview item drills to L2 with L2 pre-selected and L1 as filter', () => {
    const withL1: BasinState = { ...atL1, selectedL1: 'P01' };
    const next = basinReducer(withL1, { type: 'SELECT_L2_FROM_PREVIEW', subbasinId: '42' });
    expect(next.basinLevel).toBe('subbasin-l2');
    expect(next.selectedL2).toBe('42');
    expect(next.l2FilterSbCode).toBe('P01');
  });

  it('BACK from subbasin-l1 returns to watershed and clears basin + L1 selection', () => {
    const withL1: BasinState = { ...atL1, selectedL1: 'P01' };
    const next = basinReducer(withL1, { type: 'BACK' });
    expect(next.basinLevel).toBe('watershed');
    expect(next.selectedBasin).toBeNull();
    expect(next.selectedL1).toBeNull();
  });

  it('click outside (BACK) from L1 with no L1 selected still returns to watershed', () => {
    const next = basinReducer(atL1, { type: 'BACK' });
    expect(next.basinLevel).toBe('watershed');
    expect(next.selectedBasin).toBeNull();
  });
});

// ─── Sub-basin L2 level ───────────────────────────────────────────────────────

describe('Sub-basin L2 level', () => {
  const atL2: BasinState = {
    ...init,
    basinLevel: 'subbasin-l2',
    selectedBasin: 'ping',
    selectedL1: 'P01',
    l2FilterSbCode: 'P01',
    selectedL2: null,
  };

  it('selecting an L2 item sets selectedL2 and stays at subbasin-l2', () => {
    const next = basinReducer(atL2, { type: 'SELECT_L2', subbasinId: '7' });
    expect(next.selectedL2).toBe('7');
    expect(next.basinLevel).toBe('subbasin-l2');
  });

  it('BACK from subbasin-l2 returns to subbasin-l1 and clears L2 + filter', () => {
    const withL2: BasinState = { ...atL2, selectedL2: '7' };
    const next = basinReducer(withL2, { type: 'BACK' });
    expect(next.basinLevel).toBe('subbasin-l1');
    expect(next.selectedL2).toBeNull();
    expect(next.l2FilterSbCode).toBeNull();
    expect(next.selectedBasin).toBe('ping'); // basin preserved
    expect(next.selectedL1).toBe('P01');     // L1 preserved
  });

  it('BACK from L2 with no L2 selected still returns to subbasin-l1', () => {
    const next = basinReducer(atL2, { type: 'BACK' });
    expect(next.basinLevel).toBe('subbasin-l1');
  });

  it('click outside (BACK) from L2 via unfiltered drill also returns to L1', () => {
    const unfiltered: BasinState = { ...atL2, l2FilterSbCode: null, selectedL1: null, l2EntryFromWatershed: false };
    const next = basinReducer(unfiltered, { type: 'BACK' });
    expect(next.basinLevel).toBe('subbasin-l1');
  });
});

// ─── DRILL_L2_FROM_WATERSHED ──────────────────────────────────────────────────

describe('DRILL_L2_FROM_WATERSHED', () => {
  const withBasin: BasinState = { ...initialBasinState, selectedBasin: 'ping', basinLevel: 'watershed' };

  it('jumps straight to subbasin-l2 with no L1 filter', () => {
    const next = basinReducer(withBasin, { type: 'DRILL_L2_FROM_WATERSHED' });
    expect(next.basinLevel).toBe('subbasin-l2');
    expect(next.selectedL1).toBeNull();
    expect(next.l2FilterSbCode).toBeNull();
    expect(next.l2EntryFromWatershed).toBe(true);
  });

  it('BACK from watershed-entered L2 returns to watershed (not L1)', () => {
    const atWatershedL2 = basinReducer(withBasin, { type: 'DRILL_L2_FROM_WATERSHED' });
    const back = basinReducer(atWatershedL2, { type: 'BACK' });
    expect(back.basinLevel).toBe('watershed');
    expect(back.selectedBasin).toBe('ping');
    expect(back.selectedL1).toBeNull();
    expect(back.l2EntryFromWatershed).toBe(false);
  });
});

// ─── Full navigation flows ────────────────────────────────────────────────────

describe('Full navigation flows', () => {
  it('full drill: watershed → L1 → L2 → back to L1 → back to watershed', () => {
    const s1 = basinReducer(init, { type: 'SELECT_BASIN', basin: 'ping' });
    expect(s1.basinLevel).toBe('watershed');

    const s2 = basinReducer(s1, { type: 'SELECT_BASIN', basin: 'ping' });
    expect(s2.basinLevel).toBe('subbasin-l1');

    const s3 = basinReducer(s2, { type: 'SELECT_L1', sbCode: 'P01' });
    expect(s3.selectedL1).toBe('P01');

    const s4 = basinReducer(s3, { type: 'DRILL_L2_FROM_L1', sbCode: 'P01' });
    expect(s4.basinLevel).toBe('subbasin-l2');
    expect(s4.l2FilterSbCode).toBe('P01');

    const s5 = basinReducer(s4, { type: 'BACK' });
    expect(s5.basinLevel).toBe('subbasin-l1');
    expect(s5.selectedL1).toBe('P01'); // L1 preserved on back from L2

    const s6 = basinReducer(s5, { type: 'BACK' });
    expect(s6.basinLevel).toBe('watershed');
    expect(s6.selectedBasin).toBeNull();
  });

  it('select basin → click outside → basin deselected, still at watershed', () => {
    const s1 = basinReducer(init, { type: 'SELECT_BASIN', basin: 'yom' });
    const s2 = basinReducer(s1, { type: 'BACK' });
    expect(s2.selectedBasin).toBeNull();
    expect(s2.basinLevel).toBe('watershed');
  });

  it('L2 via preview path: L1 view → preview click → L2 pre-selected', () => {
    const atL1: BasinState = { ...init, basinLevel: 'subbasin-l1', selectedBasin: 'yom', selectedL1: 'Y02' };
    const next = basinReducer(atL1, { type: 'SELECT_L2_FROM_PREVIEW', subbasinId: '15' });
    expect(next.basinLevel).toBe('subbasin-l2');
    expect(next.selectedL2).toBe('15');
    expect(next.l2FilterSbCode).toBe('Y02');
  });

  it('RESET returns to initial state from any depth', () => {
    const deep = apply(
      init,
      { type: 'SELECT_BASIN', basin: 'ping' },
      { type: 'SELECT_BASIN', basin: 'ping' },
      { type: 'SELECT_L1', sbCode: 'P01' },
      { type: 'DRILL_L2_FROM_L1', sbCode: 'P01' },
      { type: 'SELECT_L2', subbasinId: '3' },
    );
    expect(basinReducer(deep, { type: 'RESET' })).toEqual(initialBasinState);
  });
});

// ─── State immutability ───────────────────────────────────────────────────────

describe('State immutability', () => {
  it('reducer never mutates the input state', () => {
    const state: BasinState = { ...init, selectedBasin: 'ping' };
    const frozen = Object.freeze(state);
    expect(() => basinReducer(frozen, { type: 'SELECT_BASIN', basin: 'ping' })).not.toThrow();
  });

  it('no-op actions return the same reference', () => {
    // BACK with no selection should return same object (or at minimum equal state)
    const next = basinReducer(init, { type: 'BACK' });
    expect(next).toEqual(init);
  });
});
