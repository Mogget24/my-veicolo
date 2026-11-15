CREATE TABLE "deadline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"done_date" date,
	"previous_due_date" date,
	"new_due_date" date,
	"cost_eur" numeric(10, 2),
	"company" text,
	"km" integer,
	"notes" text,
	"done_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"due_date" date,
	"estimated" boolean DEFAULT false NOT NULL,
	"recurrence_months" integer,
	"snoozed_until" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"deadline_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"stage" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_deadline_id_user_id_stage_pk" PRIMARY KEY("deadline_id","user_id","stage")
);
--> statement-breakpoint
ALTER TABLE "deadline_events" ADD CONSTRAINT "deadline_events_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_events" ADD CONSTRAINT "deadline_events_done_by_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deadline_events_deadline_id_idx" ON "deadline_events" USING btree ("deadline_id");--> statement-breakpoint
CREATE INDEX "deadlines_vehicle_id_idx" ON "deadlines" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deadlines_vehicle_type_unique" ON "deadlines" USING btree ("vehicle_id","type") WHERE "deadlines"."type" <> 'custom';