CREATE TABLE "time_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"weekday" integer,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "time_blocks_date_idx" ON "time_blocks" USING btree ("date");--> statement-breakpoint
REVOKE ALL ON "time_blocks" FROM anon, authenticated;
