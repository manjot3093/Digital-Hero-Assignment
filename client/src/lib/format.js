/**
 * Money is stored and transported as integer minor units (pence). Conversion
 * to a decimal happens here and nowhere else, so no arithmetic in the UI can
 * introduce floating-point drift into a displayed figure.
 */
const DEFAULT_CURRENCY = 'GBP';
const DEFAULT_LOCALE = 'en-GB';

export function money(minor, { currency = DEFAULT_CURRENCY, compact = false, decimals } = {}) {
  const value = Number(minor ?? 0) / 100;
  const fractionDigits = decimals ?? (Number.isInteger(value) && compact ? 0 : 2);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
    notation: compact && Math.abs(value) >= 10000 ? 'compact' : 'standard',
  }).format(value);
}

export function number(value, options = {}) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(Number(value ?? 0));
}

export function percent(value) {
  return `${Number(value ?? 0)}%`;
}

export function date(value, options = {}) {
  if (!value) return '—';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(parsed);
}

export function dateTime(value) {
  return date(value, { hour: '2-digit', minute: '2-digit' });
}

export function monthLabel(value) {
  if (!value) return '—';
  const parsed = new Date(`${String(value).slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(parsed);
}

export function relativeDays(value) {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const days = Math.round((target - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function initials(first = '', last = '') {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '··';
}

export function titleCase(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
