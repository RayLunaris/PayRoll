CREATE TABLE IF NOT EXISTS "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer,
	"category" varchar(30) NOT NULL,
	"department_id" uuid,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"spent_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "position_salary_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"old_base_salary" numeric(15, 2) NOT NULL,
	"new_base_salary" numeric(15, 2) NOT NULL,
	"old_allowance" numeric(15, 2),
	"new_allowance" numeric(15, 2),
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"client_name" varchar(150),
	"manager_user_id" uuid,
	"total_budget" numeric(15, 2) NOT NULL,
	"labor_budget" numeric(15, 2) DEFAULT '0.00',
	"operational_budget" numeric(15, 2) DEFAULT '0.00',
	"spent_labor" numeric(15, 2) DEFAULT '0.00',
	"spent_operational" numeric(15, 2) DEFAULT '0.00',
	"start_date" date NOT NULL,
	"end_date" date,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role_in_project" varchar(100) NOT NULL,
	"allocation_percentage" numeric(5, 2) DEFAULT '100.00',
	"assigned_monthly_cost" numeric(15, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"expense_title" varchar(200) NOT NULL,
	"category" varchar(50) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"receipt_url" text,
	"submitted_by_user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'approved',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "code" varchar(20);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "level_rank" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "min_salary" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "max_salary" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "position_allowance" numeric(15, 2) DEFAULT '0.00';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budgets" ADD CONSTRAINT "budgets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "position_salary_audit_logs" ADD CONSTRAINT "position_salary_audit_logs_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "position_salary_audit_logs" ADD CONSTRAINT "position_salary_audit_logs_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_code_unique" UNIQUE("code");