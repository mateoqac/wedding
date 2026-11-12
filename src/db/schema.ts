import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { FORMATS } from "@/invitations/formats";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const invitationStatus = pgEnum("invitation_status", ["draft", "paid"]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
  "refunded",
  "charged_back",
]);

export const exportFormat = pgEnum("export_format", FORMATS);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const magicLinkTokens = pgTable("magic_link_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    editTokenHash: text("edit_token_hash").notNull().unique(),
    templateId: text("template_id").notNull(),
    templateVersion: integer("template_version").notNull(),
    data: jsonb("data").notNull(),
    options: jsonb("options").notNull(),
    // Cache of the status derived from `payments`; written only by the payment service,
    // in the same transaction as the payment change (design §4).
    status: invitationStatus("status").notNull().default("draft"),
    paidCoupleNames: jsonb("paid_couple_names"),
    namesUnlockedBy: text("names_unlocked_by"),
    namesUnlockedAt: timestamp("names_unlocked_at", { withTimezone: true }),
    namesUnlockReason: text("names_unlock_reason"),
    editWindowEndsAt: timestamp("edit_window_ends_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("invitations_user_id_idx").on(table.userId),
    // Supports the anonymous draft TTL cleanup (design §6).
    index("invitations_anonymous_activity_idx")
      .on(table.lastActivityAt)
      .where(sql`${table.userId} is null`),
    check("invitations_template_version_positive", sql`${table.templateVersion} > 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref").notNull().unique(),
    amountClp: integer("amount_clp").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    rawPayload: jsonb("raw_payload"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("payments_invitation_id_idx").on(table.invitationId),
    check("payments_amount_clp_positive", sql`${table.amountClp} > 0`),
  ],
);

export const exports = pgTable(
  "exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    format: exportFormat("format").notNull(),
    contentHash: text("content_hash").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("exports_invitation_format_hash_idx").on(
      table.invitationId,
      table.format,
      table.contentHash,
    ),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);
