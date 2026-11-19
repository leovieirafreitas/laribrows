ALTER TABLE "appointments" ADD COLUMN "promo_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_price_cents" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "promo_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "promo_label" text DEFAULT 'Black Friday' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "promo_start" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "promo_end" text DEFAULT '' NOT NULL;