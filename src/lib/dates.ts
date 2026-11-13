import { parseIsoDate } from "@/invitations/iso-date";

const longDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" });

/** "17 de octubre de 2026" from a `YYYY-MM-DD` wedding date; the raw value if it is not a valid date. */
export function formatIsoDate(value: string): string {
  const parts = parseIsoDate(value);
  if (!parts) return value;
  return longDate.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

/** Calendar day (UTC) of an instant, in the same long form. */
export function formatDay(date: Date): string {
  return longDate.format(date);
}
