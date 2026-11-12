import { z } from "zod";
import {
  clockTime,
  httpsUrl,
  isoDate,
  longText,
  personName,
  phone,
  shortText,
} from "@/invitations/fields";

/**
 * Data schema for the reference template "clasico-marco-doble", version 1.
 * Immutable once published: changes go into a new version directory.
 */
export const invitationDataSchema = z.object({
  parentsOne: z.array(personName).min(1).max(2),
  parentsTwo: z.array(personName).min(1).max(2),
  couple: z.object({
    partnerOne: personName,
    partnerTwo: personName,
  }),
  ceremony: z.object({
    description: longText,
    address: shortText,
    date: isoDate,
    time: clockTime,
  }),
  party: z
    .object({
      venue: shortText,
      address: shortText,
      time: clockTime,
    })
    .optional(),
  rsvp: z.object({
    phones: z.array(phone).min(1).max(3),
    email: z.email().optional(),
  }),
  issuedAt: z.object({
    city: shortText,
    label: shortText,
  }),
  venueMapUrl: httpsUrl.optional(),
  giftRegistry: z
    .object({
      label: shortText.optional(),
      url: httpsUrl.optional(),
    })
    .refine((registry) => registry.label !== undefined || registry.url !== undefined, {
      message: "Gift registry needs a label or a link",
    })
    .optional(),
  envelopeAddress: shortText.optional(),
});

export type InvitationData = z.infer<typeof invitationDataSchema>;
