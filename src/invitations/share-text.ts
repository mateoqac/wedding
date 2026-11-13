import type { InvitationData } from "@/templates/clasico-marco-doble/v1/schema";
import { formatSpanishDate } from "@/templates/clasico-marco-doble/v1/Template";

const listEs = (items: string[], last = "y") =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;

/**
 * Plain-text version of the invitation. Couples paste it as the description or alt text
 * when they share the image (WhatsApp, Instagram), so people using screen readers get
 * every detail the picture shows.
 */
export function buildShareText(data: InvitationData): string {
  const { couple, ceremony, party, rsvp, issuedAt, venueMapUrl, giftRegistry } = data;
  const lines = [
    `Parte de matrimonio de ${couple.partnerOne} y ${couple.partnerTwo}.`,
    `Sus padres, ${data.parentsOne.join(" y ")}, y ${data.parentsTwo.join(" y ")}, tienen el agrado de invitarle.`,
    `${ceremony.description}: ${formatSpanishDate(ceremony.date)} a las ${ceremony.time} horas, en ${ceremony.address}.`,
  ];
  if (party) lines.push(`Recepción: ${party.time} horas en ${party.venue}, ${party.address}.`);
  const contacts = [...rsvp.phones, ...(rsvp.email ? [rsvp.email] : [])];
  lines.push(`Confirmar asistencia: ${listEs(contacts, "o")}.`);
  if (venueMapUrl) lines.push(`Cómo llegar: ${venueMapUrl}`);
  if (giftRegistry) {
    const label = giftRegistry.label ?? "Lista de regalos";
    lines.push(
      giftRegistry.url
        ? `Lista de regalos: ${giftRegistry.label ? `${label} (${giftRegistry.url})` : giftRegistry.url}.`
        : `Lista de regalos: ${label}.`,
    );
  }
  lines.push(`${issuedAt.city}, ${issuedAt.label}.`);
  return lines.join("\n");
}
