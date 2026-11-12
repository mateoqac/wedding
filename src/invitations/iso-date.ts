const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface IsoDateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Parses a calendar date in `YYYY-MM-DD` form, rejecting impossible dates such as 2026-02-30. */
export function parseIsoDate(value: string): IsoDateParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isSameDay =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isSameDay ? { year, month, day } : null;
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}
