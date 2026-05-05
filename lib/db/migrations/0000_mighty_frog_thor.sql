CREATE TYPE "public"."billing_cycle" AS ENUM('split-month', 'anchor-day');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"package_cost" integer NOT NULL,
	"target_cost" integer NOT NULL,
	"total_ads_amount" integer DEFAULT 0 NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'split-month' NOT NULL,
	"anchor_day" smallint,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"onboarded_on" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_name_chk" CHECK (length("clients"."name") > 0),
	CONSTRAINT "clients_package_cost_chk" CHECK ("clients"."package_cost" >= 0),
	CONSTRAINT "clients_target_cost_chk" CHECK ("clients"."target_cost" >= 0),
	CONSTRAINT "clients_total_ads_chk" CHECK ("clients"."total_ads_amount" >= 0),
	CONSTRAINT "clients_anchor_day_chk" CHECK (("clients"."billing_cycle" = 'split-month' AND "clients"."anchor_day" IS NULL)
          OR ("clients"."billing_cycle" = 'anchor-day' AND "clients"."anchor_day" BETWEEN 1 AND 28))
);
--> statement-breakpoint
CREATE TABLE "credits" (
	"client_id" uuid NOT NULL,
	"target_year" integer NOT NULL,
	"target_month" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "credits_client_id_target_year_target_month_pk" PRIMARY KEY("client_id","target_year","target_month"),
	CONSTRAINT "credits_amount_chk" CHECK ("credits"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"expected_amount" integer NOT NULL,
	"due_date" date NOT NULL,
	CONSTRAINT "installments_slot_chk" CHECK ("installments"."slot" IN (1, 2)),
	CONSTRAINT "installments_expected_chk" CHECK ("installments"."expected_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_read_state" (
	"notification_key" varchar(128) PRIMARY KEY NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"period_id" uuid,
	"target_year" integer NOT NULL,
	"target_month" integer NOT NULL,
	"slot" smallint,
	"amount" integer NOT NULL,
	"received_on" date DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_target_year_chk" CHECK ("payments"."target_year" BETWEEN 2024 AND 2100),
	CONSTRAINT "payments_target_month_chk" CHECK ("payments"."target_month" BETWEEN 1 AND 12),
	CONSTRAINT "payments_slot_chk" CHECK ("payments"."slot" IS NULL OR "payments"."slot" IN (1, 2)),
	CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"period_start_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"base_target" integer NOT NULL,
	"carry_forward_from_prev" integer DEFAULT 0 NOT NULL,
	"effective_target" integer NOT NULL,
	"cycle_snapshot" "billing_cycle" NOT NULL,
	"anchor_day_snapshot" smallint,
	"closed_at" timestamp with time zone,
	"closed_unpaid" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periods_year_chk" CHECK ("periods"."year" BETWEEN 2024 AND 2100),
	CONSTRAINT "periods_month_chk" CHECK ("periods"."month" BETWEEN 1 AND 12),
	CONSTRAINT "periods_base_target_chk" CHECK ("periods"."base_target" >= 0),
	CONSTRAINT "periods_carry_fwd_chk" CHECK ("periods"."carry_forward_from_prev" >= 0),
	CONSTRAINT "periods_effective_target_chk" CHECK ("periods"."effective_target" >= 0),
	CONSTRAINT "periods_end_after_start_chk" CHECK ("periods"."period_end_date" >= "periods"."period_start_date")
);
--> statement-breakpoint
CREATE TABLE "special_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"service_date" date DEFAULT now() NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "special_services_title_chk" CHECK (length("special_services"."title") > 0),
	CONSTRAINT "special_services_desc_chk" CHECK ("special_services"."description" IS NULL OR length("special_services"."description") <= 1000),
	CONSTRAINT "special_services_price_chk" CHECK ("special_services"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_services" ADD CONSTRAINT "special_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_billing_cycle_idx" ON "clients" USING btree ("billing_cycle");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_period_slot_uq" ON "installments" USING btree ("period_id","slot");--> statement-breakpoint
CREATE INDEX "installments_due_date_idx" ON "installments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payments_client_target_idx" ON "payments" USING btree ("client_id","target_year","target_month");--> statement-breakpoint
CREATE INDEX "payments_period_id_idx" ON "payments" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "periods_client_year_month_uq" ON "periods" USING btree ("client_id","year","month");--> statement-breakpoint
CREATE INDEX "periods_client_id_idx" ON "periods" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "periods_start_date_idx" ON "periods" USING btree ("period_start_date");--> statement-breakpoint
CREATE INDEX "special_services_client_idx" ON "special_services" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "special_services_unpaid_age_idx" ON "special_services" USING btree ("paid","service_date");