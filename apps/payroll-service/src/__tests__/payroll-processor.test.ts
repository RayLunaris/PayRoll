import { describe, expect, it } from 'vitest';
import { calculateBudgetSpendDelta } from '../services/payroll-processor.js';

describe('calculateBudgetSpendDelta', () => {
  it('adds the full amount for a new payroll record', () => {
    expect(calculateBudgetSpendDelta('0.00', 4250000)).toBe(4250000);
  });

  it('only applies the difference when a payroll is recalculated upward', () => {
    expect(calculateBudgetSpendDelta('4250000.00', 4500000)).toBe(250000);
  });

  it('reduces realization when a payroll is recalculated downward', () => {
    expect(calculateBudgetSpendDelta('4500000.00', 4250000)).toBe(-250000);
  });

  it('does not change realization when the net salary is unchanged', () => {
    expect(calculateBudgetSpendDelta('4250000.00', 4250000)).toBe(0);
  });
});
