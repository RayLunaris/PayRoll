export function formatRupiah(value: number): string {
  if (!value || isNaN(value)) return 'Rp 0';
  if (value >= 1_000_000_000_000) {
    const formatted = (value / 1_000_000_000_000).toFixed(1).replace('.', ',');
    return `Rp ${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted}T`;
  }
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(0)}M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(0)}jt`;
  }
  if (value >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(0)}K`;
  }
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatCompact(value: number): string {
  if (!value || isNaN(value)) return '0';
  return formatRupiah(value).replace(/^Rp\s*/, '');
}

export function formatRupiahNumber(value: number): string {
  if (!value || isNaN(value)) return 'Rp 0';
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

