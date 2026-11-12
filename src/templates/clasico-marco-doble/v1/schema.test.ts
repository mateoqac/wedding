import { describe, expect, it } from "vitest";
import { invitationDataSchema, type InvitationData } from "./schema";

// Reference data taken from the sample invitation PDF.
const reference: InvitationData = {
  parentsOne: ["Osvaldo Carmona Morales", "Marcela Redard Ayala"],
  parentsTwo: ["Álvaro Galán Díaz", "Paula Piazzano Zamorano"],
  couple: { partnerOne: "Álvaro Galán Piazzano", partnerTwo: "Francisca Carmona Redard" },
  ceremony: {
    description:
      "Ceremonia religiosa que se efectuará con misa de precepto en la Capilla del Colegio Cumbres",
    address: "Av. La Plaza 1150, Las Condes",
    date: "2026-11-14",
    time: "16:45",
  },
  party: {
    venue: "Centro de Eventos Arboleda Chicureo",
    address: "Alba 1 / 11640, Chicureo, Colina",
    time: "22:00",
  },
  rsvp: { phones: ["+56 9 8299 5134", "+56 9 8134 7187"], email: "familiagalancarmona@gmail.com" },
  issuedAt: { city: "Santiago", label: "octubre 2026" },
  venueMapUrl: "https://waze.com/ul?q=Arboleda%20Chicureo",
  giftRegistry: { label: "Novios Falabella - Código 2104134", url: "https://www.falabella.com/novios" },
  envelopeAddress: "Camino del Manzanar 11843, Las Condes",
};

const withField = (patch: Partial<Record<keyof InvitationData, unknown>>) => ({
  ...reference,
  ...patch,
});

describe("clasico-marco-doble v1 schema", () => {
  it("accepts the reference invitation", () => {
    expect(invitationDataSchema.safeParse(reference).success).toBe(true);
  });

  it("accepts an invitation without any optional field", () => {
    const { party, venueMapUrl, giftRegistry, envelopeAddress, ...required } = reference;
    expect(invitationDataSchema.safeParse(required).success).toBe(true);
  });

  it.each([
    ["http", "http://www.falabella.com/novios"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/html,<script>alert(1)</script>"],
    ["not a url", "falabella novios"],
  ])("rejects a %s gift registry URL", (_kind, url) => {
    const result = invitationDataSchema.safeParse(
      withField({ giftRegistry: { label: "Lista", url } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-https venue map URL", () => {
    expect(
      invitationDataSchema.safeParse(withField({ venueMapUrl: "http://waze.com" })).success,
    ).toBe(false);
  });

  it("requires a label or a URL in the gift registry", () => {
    expect(invitationDataSchema.safeParse(withField({ giftRegistry: {} })).success).toBe(false);
  });

  it("rejects an impossible ceremony date", () => {
    const ceremony = { ...reference.ceremony, date: "2026-02-30" };
    expect(invitationDataSchema.safeParse(withField({ ceremony })).success).toBe(false);
  });

  it("rejects an invalid ceremony time", () => {
    const ceremony = { ...reference.ceremony, time: "25:00" };
    expect(invitationDataSchema.safeParse(withField({ ceremony })).success).toBe(false);
  });

  it("rejects an empty partner name", () => {
    const couple = { ...reference.couple, partnerOne: "   " };
    expect(invitationDataSchema.safeParse(withField({ couple })).success).toBe(false);
  });

  it("requires at least one R.S.V.P. phone", () => {
    expect(
      invitationDataSchema.safeParse(withField({ rsvp: { phones: [] } })).success,
    ).toBe(false);
  });

  it("trims surrounding whitespace in names", () => {
    const couple = { ...reference.couple, partnerOne: "  Álvaro Galán Piazzano " };
    const parsed = invitationDataSchema.parse(withField({ couple }));
    expect(parsed.couple.partnerOne).toBe("Álvaro Galán Piazzano");
  });
});
