CREATE TYPE "public"."export_format" AS ENUM('print-pdf', 'digital-pdf', 'png', 'jpg', 'story');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('draft', 'paid');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'refunded', 'charged_back');--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"format" "export_format" NOT NULL,
	"content_hash" text NOT NULL,
	"r2_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"edit_token_hash" text NOT NULL,
	"template_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"status" "invitation_status" DEFAULT 'draft' NOT NULL,
	"paid_couple_names" jsonb,
	"names_unlocked_by" text,
	"names_unlocked_at" timestamp with time zone,
	"names_unlock_reason" text,
	"edit_window_ends_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_edit_token_hash_unique" UNIQUE("edit_token_hash"),
	CONSTRAINT "invitations_template_version_positive" CHECK ("invitations"."template_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"amount_clp" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_unique" UNIQUE("provider_ref"),
	CONSTRAINT "payments_amount_clp_positive" CHECK ("payments"."amount_clp" > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exports_invitation_format_hash_idx" ON "exports" USING btree ("invitation_id","format","content_hash");--> statement-breakpoint
CREATE INDEX "invitations_user_id_idx" ON "invitations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitations_anonymous_activity_idx" ON "invitations" USING btree ("last_activity_at") WHERE "invitations"."user_id" is null;--> statement-breakpoint
CREATE INDEX "payments_invitation_id_idx" ON "payments" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");