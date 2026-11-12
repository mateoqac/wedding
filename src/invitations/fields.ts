import { z } from "zod";
import { isIsoDate } from "./iso-date";

/** Reusable field schemas shared by every template version. */

export const personName = z.string().trim().min(1).max(80);

export const shortText = z.string().trim().min(1).max(120);

export const longText = z.string().trim().min(1).max(240);

/** Only `https:` links are accepted (design §7): no http, javascript:, or data: URLs. */
export const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const isoDate = z.string().refine(isIsoDate, { message: "Invalid date (YYYY-MM-DD)" });

export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)");

export const phone = z.string().trim().regex(/^\+?[\d\s()-]{6,20}$/, "Invalid phone number");
