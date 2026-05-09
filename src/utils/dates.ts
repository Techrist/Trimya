import { getCurrentLocale, localeToBcp47 } from '@/i18n';

function bcp47(): string {
  return localeToBcp47(getCurrentLocale());
}

export function formatDate(ts: number, options: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}): string {
  return new Date(ts).toLocaleDateString(bcp47(), options);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(bcp47(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayMonth(ts: number): string {
  return new Date(ts).toLocaleDateString(bcp47(), {
    day: '2-digit',
    month: 'short',
  });
}

export function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(bcp47(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatFullLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(bcp47(), {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
