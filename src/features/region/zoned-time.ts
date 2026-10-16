/**
 * Wall-clock time in a given IANA time zone, independent of the device's.
 *
 * Intl gives us the zone's wall time; we turn that into an offset from UTC
 * and cache it per zone per minute (offset changes — DST, policy — happen on
 * minute boundaries), so per-frame clock updates stay cheap.
 */
export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, number>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Milliseconds to add to UTC to get the zone's wall time at this instant. */
export function zoneOffsetMs(timeZone: string, epochMs: number): number {
  const minute = Math.floor(epochMs / 60_000);
  const key = `${timeZone}|${minute}`;
  const cached = offsetCache.get(key);
  if (cached !== undefined) return cached;

  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(minute * 60_000))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  const offset = wallAsUtc - minute * 60_000;

  if (offsetCache.size > 64) offsetCache.clear();
  offsetCache.set(key, offset);
  return offset;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const wall = new Date(date.getTime() + zoneOffsetMs(timeZone, date.getTime()));
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
    hours: wall.getUTCHours(),
    minutes: wall.getUTCMinutes(),
    seconds: wall.getUTCSeconds(),
    milliseconds: wall.getUTCMilliseconds(),
  };
}

/** e.g. "UTC+05:45" */
export function formatOffset(timeZone: string, date = new Date()): string {
  const total = Math.round(zoneOffsetMs(timeZone, date.getTime()) / 60_000);
  const sign = total < 0 ? '−' : '+';
  const abs = Math.abs(total);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
