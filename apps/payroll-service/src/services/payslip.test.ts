import { describe, expect, it } from 'vitest';
import { formatRupiah } from './payslip';

const NBSP = '\u00A0';

describe('formatRupiah', () => {
  it('should format whole millions with id-ID grouping', () => {
    expect(formatRupiah(5000000)).toBe(`Rp${NBSP}5.000.000`);
  });

  it('should format zero', () => {
    expect(formatRupiah(0)).toBe(`Rp${NBSP}0`);
  });

  it('should round fractional values to whole rupiah', () => {
    expect(formatRupiah(4862000)).toBe(`Rp${NBSP}4.862.000`);
  });

  it('should format small values', () => {
    expect(formatRupiah(86703)).toBe(`Rp${NBSP}86.703`);
  });
});