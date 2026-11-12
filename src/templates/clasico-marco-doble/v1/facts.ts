import { z } from "zod";
import { isoDate, personName } from "@/invitations/fields";
import type { InvitationFacts } from "@/templates/registry";

const factsSchema = z.object({
  couple: z.object({ partnerOne: personName, partnerTwo: personName }),
  ceremony: z.object({ date: isoDate }),
});

export function extractFacts(data: unknown): InvitationFacts {
  const { couple, ceremony } = factsSchema.parse(data);
  return { coupleNames: [couple.partnerOne, couple.partnerTwo], weddingDate: ceremony.date };
}
