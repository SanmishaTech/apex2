// Locale & formatting utilities: date / datetime / relative time / currency formatting read from NEXT_PUBLIC_* env.
// Provides consistent internationalization primitives without pulling heavy i18n frameworks.
// Locale & formatting helpers reading from env variables (NEXT_PUBLIC_*)
import { format as dfFormat } from 'date-fns';

const ENV = {
  locale: process.env.NEXT_PUBLIC_LOCALE || 'en-IN',
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || 'UTC',
  dateFormat: process.env.NEXT_PUBLIC_DATE_FORMAT || 'yyyy-MM-dd',
  dateTimeFormat: process.env.NEXT_PUBLIC_DATETIME_FORMAT || '', // if blank -> uses Intl fallback
  currency: process.env.NEXT_PUBLIC_CURRENCY || 'INR'
};

export function getLocaleConfig() {
  return { ...ENV };
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date(NaN);
}

// Format date using date-fns pattern if provided, else Intl
export function formatDate(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '';
  const d = toDate(value);
  if (isNaN(d.getTime())) return '';
  if (ENV.dateFormat && !opts) {
    try {
      return dfFormat(d, ENV.dateFormat);
  } catch {
      // fallthrough to Intl
    }
  }
  const { locale, timezone } = ENV;
  const base: Intl.DateTimeFormatOptions = opts || { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, ...base }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '';
  const d = toDate(value);
  if (isNaN(d.getTime())) return '';
  if (ENV.dateTimeFormat && !opts) {
    try {
      return dfFormat(d, ENV.dateTimeFormat);
  } catch {
      // fallback to Intl
    }
  }
  // Default Intl pattern if no custom dateTimeFormat
  return formatDate(d, opts || { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Format date for HTML input[type="date"] - returns YYYY-MM-DD format
export function formatDateForInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (isNaN(d.getTime())) return '';
  return dfFormat(d, 'yyyy-MM-dd');
}

export function formatCurrency(amount: number, currencyCode?: string, minimumFractionDigits = 0) {
  const { locale, currency } = ENV;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode || currency, minimumFractionDigits }).format(amount);
}

// Relative time formatter (loose typing)
type RTUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';

const _REL_UNITS: { unit: RTUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

// formatRelativeTime(date, new Date()) => "5m ago" (default short style)
export function formatRelativeTime(
  value: Date | string | null | undefined,
  base: Date = new Date(),
  opts: { numeric?: 'auto' | 'always'; style?: 'long' | 'short' | 'narrow'; nowThresholdSeconds?: number } = {}
) {
  if (!value) return '';
  const target = toDate(value);
  if (isNaN(target.getTime())) return '';

  const { locale } = ENV;
  const numeric = opts.numeric || 'auto';
  const style = opts.style || 'short';
  const nowThreshold = opts.nowThresholdSeconds ?? 30;

  const diffMs = target.getTime() - base.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  if (Math.abs(diffSeconds) <= nowThreshold) return 'now';

  let picked: { unit: RTUnit; seconds: number } = _REL_UNITS[_REL_UNITS.length - 1];
  for (const u of _REL_UNITS) {
    if (Math.abs(diffSeconds) >= u.seconds) { picked = u; break; }
  }
  const raw = diffSeconds / picked.seconds;

  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric, style });
    return rtf.format(Math.round(raw), picked.unit);
  }
  const rounded = Math.round(Math.abs(raw));
  const plural = rounded === 1 ? picked.unit : picked.unit + 's';
  return diffSeconds < 0 ? `${rounded} ${plural} ago` : `in ${rounded} ${plural}`;
}
