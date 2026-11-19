CREATE TABLE "client_profiles" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "client_profiles" FROM anon, authenticated;
