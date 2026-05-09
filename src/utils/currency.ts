import { getCurrentLocale, localeToBcp47 } from '@/i18n';

export const DEFAULT_CURRENCY = 'FCFA';

export function formatPrice(amount: number | undefined, currency = DEFAULT_CURRENCY): string {
  if (amount === undefined || amount === null) return '—';
  if (amount === 0) return `0 ${currency}`;
  const bcp47 = localeToBcp47(getCurrentLocale());
  const formatted = new Intl.NumberFormat(bcp47).format(amount);
  return `${formatted} ${currency}`;
}

export function parsePriceInput(input: string): number {
  const cleaned = input.replace(/\s+/g, '').replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}
