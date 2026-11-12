/** Flat form state for clasico-marco-doble v1 and its conversion to template data. */
export interface FormState {
  parentsOne: [string, string];
  parentsTwo: [string, string];
  partnerOne: string;
  partnerTwo: string;
  ceremonyDescription: string;
  ceremonyAddress: string;
  ceremonyDate: string;
  ceremonyTime: string;
  partyVenue: string;
  partyAddress: string;
  partyTime: string;
  phones: [string, string, string];
  rsvpEmail: string;
  issuedCity: string;
  issuedLabel: string;
  venueMapUrl: string;
  giftLabel: string;
  giftUrl: string;
  envelopeAddress: string;
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

// biome-ignore lint: data comes from the database as unknown JSON
export function toFormState(data: any): FormState {
  return {
    parentsOne: [s(data?.parentsOne?.[0]), s(data?.parentsOne?.[1])],
    parentsTwo: [s(data?.parentsTwo?.[0]), s(data?.parentsTwo?.[1])],
    partnerOne: s(data?.couple?.partnerOne),
    partnerTwo: s(data?.couple?.partnerTwo),
    ceremonyDescription: s(data?.ceremony?.description),
    ceremonyAddress: s(data?.ceremony?.address),
    ceremonyDate: s(data?.ceremony?.date),
    ceremonyTime: s(data?.ceremony?.time),
    partyVenue: s(data?.party?.venue),
    partyAddress: s(data?.party?.address),
    partyTime: s(data?.party?.time),
    phones: [s(data?.rsvp?.phones?.[0]), s(data?.rsvp?.phones?.[1]), s(data?.rsvp?.phones?.[2])],
    rsvpEmail: s(data?.rsvp?.email),
    issuedCity: s(data?.issuedAt?.city),
    issuedLabel: s(data?.issuedAt?.label),
    venueMapUrl: s(data?.venueMapUrl),
    giftLabel: s(data?.giftRegistry?.label),
    giftUrl: s(data?.giftRegistry?.url),
    envelopeAddress: s(data?.envelopeAddress),
  };
}

const t = (v: string) => v.trim();
const opt = (v: string) => (t(v) ? t(v) : undefined);
const list = (values: string[]) => values.map(t).filter(Boolean);

/** Empty optional blocks are omitted so the template removes them (design §3). */
export function toTemplateData(f: FormState) {
  const party = t(f.partyVenue) || t(f.partyAddress) || t(f.partyTime)
    ? { venue: t(f.partyVenue), address: t(f.partyAddress), time: t(f.partyTime) }
    : undefined;
  const gift = opt(f.giftLabel) || opt(f.giftUrl) ? { label: opt(f.giftLabel), url: opt(f.giftUrl) } : undefined;
  return {
    parentsOne: list(f.parentsOne),
    parentsTwo: list(f.parentsTwo),
    couple: { partnerOne: t(f.partnerOne), partnerTwo: t(f.partnerTwo) },
    ceremony: {
      description: t(f.ceremonyDescription),
      address: t(f.ceremonyAddress),
      date: t(f.ceremonyDate),
      time: t(f.ceremonyTime),
    },
    ...(party ? { party } : {}),
    rsvp: { phones: list(f.phones), ...(opt(f.rsvpEmail) ? { email: opt(f.rsvpEmail) } : {}) },
    issuedAt: { city: t(f.issuedCity), label: t(f.issuedLabel) },
    ...(opt(f.venueMapUrl) ? { venueMapUrl: opt(f.venueMapUrl) } : {}),
    ...(gift ? { giftRegistry: gift } : {}),
    ...(opt(f.envelopeAddress) ? { envelopeAddress: opt(f.envelopeAddress) } : {}),
  };
}

/** Maps schema issue paths (e.g. "couple.partnerOne") to form field names. */
export function fieldForIssue(path: string): keyof FormState | "options" {
  const map: Record<string, keyof FormState> = {
    "couple.partnerOne": "partnerOne",
    "couple.partnerTwo": "partnerTwo",
    "ceremony.description": "ceremonyDescription",
    "ceremony.address": "ceremonyAddress",
    "ceremony.date": "ceremonyDate",
    "ceremony.time": "ceremonyTime",
    "party.venue": "partyVenue",
    "party.address": "partyAddress",
    "party.time": "partyTime",
    "rsvp.email": "rsvpEmail",
    "issuedAt.city": "issuedCity",
    "issuedAt.label": "issuedLabel",
    venueMapUrl: "venueMapUrl",
    "giftRegistry.url": "giftUrl",
    "giftRegistry.label": "giftLabel",
    giftRegistry: "giftLabel",
    envelopeAddress: "envelopeAddress",
  };
  if (map[path]) return map[path];
  if (path.startsWith("parentsOne")) return "parentsOne";
  if (path.startsWith("parentsTwo")) return "parentsTwo";
  if (path.startsWith("rsvp.phones")) return "phones";
  return "options";
}
