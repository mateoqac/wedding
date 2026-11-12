import { extractFacts as clasicoMarcoDobleV1Facts } from "./clasico-marco-doble/v1/facts";

/** Template-independent facts the domain needs from an invitation's data. */
export interface InvitationFacts {
  coupleNames: string[];
  /** Wedding date as `YYYY-MM-DD`. */
  weddingDate: string;
}

type FactsExtractor = (data: unknown) => InvitationFacts;

const FACTS: Record<string, Record<number, FactsExtractor>> = {
  "clasico-marco-doble": { 1: clasicoMarcoDobleV1Facts },
};

export function getInvitationFacts(
  templateId: string,
  templateVersion: number,
  data: unknown,
): InvitationFacts {
  const extract = FACTS[templateId]?.[templateVersion];
  if (!extract) throw new Error(`Unknown template ${templateId} v${templateVersion}`);
  return extract(data);
}
