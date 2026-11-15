CREATE TABLE "api_call_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"plate" text NOT NULL,
	"cost_eur" numeric(10, 4) NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"admin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "plate_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plate" text NOT NULL,
	"provider" text NOT NULL,
	"response" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plate_lookups_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "vin" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "engine_cc" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "power_kw" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "euro_class" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "lookup_id" uuid;--> statement-breakpoint
ALTER TABLE "api_call_log" ADD CONSTRAINT "api_call_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_links" ADD CONSTRAINT "password_reset_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_links" ADD CONSTRAINT "password_reset_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_call_log_created_at_idx" ON "api_call_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "password_reset_links_user_id_idx" ON "password_reset_links" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_lookup_id_plate_lookups_id_fk" FOREIGN KEY ("lookup_id") REFERENCES "public"."plate_lookups"("id") ON DELETE set null ON UPDATE no action;