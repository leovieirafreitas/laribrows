CREATE TABLE "admins" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Admin' NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"status" text DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"total_cents" integer NOT NULL,
	"due_now_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"admin_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"date" text PRIMARY KEY NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"start_min" integer,
	"end_min" integer,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "date_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"method" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"pix_code" text,
	"checkout_url" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"studio_name" text DEFAULT 'Lari Brows' NOT NULL,
	"tagline" text DEFAULT 'Design de sobrancelhas com elegância' NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"charge_mode" text DEFAULT 'deposit' NOT NULL,
	"deposit_percent" integer DEFAULT 50 NOT NULL,
	"allow_full_payment" boolean DEFAULT true NOT NULL,
	"pix_enabled" boolean DEFAULT true NOT NULL,
	"card_enabled" boolean DEFAULT true NOT NULL,
	"pix_provider" text DEFAULT 'mercadopago' NOT NULL,
	"pix_key" text DEFAULT '' NOT NULL,
	"pix_receiver_name" text DEFAULT '' NOT NULL,
	"pix_receiver_city" text DEFAULT '' NOT NULL,
	"max_installments" integer DEFAULT 3 NOT NULL,
	"slot_interval_min" integer DEFAULT 30 NOT NULL,
	"booking_window_days" integer DEFAULT 60 NOT NULL,
	"min_advance_hours" integer DEFAULT 2 NOT NULL,
	"hold_minutes" integer DEFAULT 30 NOT NULL,
	"cancellation_policy" text DEFAULT 'O sinal garante o seu horário e é abatido no valor do procedimento. Remarcações com até 24h de antecedência. Em caso de falta sem aviso, o sinal não é devolvido.' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "working_hours" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"start_min" integer DEFAULT 540 NOT NULL,
	"end_min" integer DEFAULT 1080 NOT NULL,
	"break_start_min" integer,
	"break_end_min" integer
);
--> statement-breakpoint
ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_date_idx" ON "appointments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "appointments_service_idx" ON "appointments" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "payments_appointment_idx" ON "payments" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider","provider_ref");