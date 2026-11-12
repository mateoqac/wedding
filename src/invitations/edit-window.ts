import { parseIsoDate } from "./iso-date";

const DAYS_AFTER_WEDDING = 30;
const MAX_MONTHS_AFTER_PAYMENT = 18;

/**
 * Post-payment edit window (design §1): until the wedding date + 30 days,
 * capped at 18 months from payment.
 *
 * The wedding-based end is the end of day +30 in UTC (start of day +31). Chile is
 * UTC-3/-4, so in local time the window closes in the evening of day +30.
 */
export function computeEditWindowEnd({
  paidAt,
  weddingDate,
}: {
  paidAt: Date;
  weddingDate: string;
}): Date {
  const parts = parseIsoDate(weddingDate);
  if (!parts) throw new Error(`Invalid wedding date: ${weddingDate}`);

  const afterWedding = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + DAYS_AFTER_WEDDING + 1),
  );
  const cap = addMonthsClamped(paidAt, MAX_MONTHS_AFTER_PAYMENT);

  return afterWedding < cap ? afterWedding : cap;
}

export function isWithinEditWindow(now: Date, endsAt: Date): boolean {
  return now < endsAt;
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const result = new Date(date);
  result.setUTCFullYear(year, month, Math.min(date.getUTCDate(), lastDayOfTargetMonth));
  return result;
}
