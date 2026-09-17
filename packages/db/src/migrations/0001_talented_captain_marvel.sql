CREATE TABLE IF NOT EXISTS "shift_swaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid,
	"target_id" uuid,
	"date" date NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"decided_by" uuid,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "marital_status" varchar(20) DEFAULT 'TK/0';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "dependents" integer DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requester_id_employees_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_target_id_employees_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_emp_date_idx" UNIQUE("employee_id","date");--> statement-breakpoint
ALTER TABLE "leave_quotas" ADD CONSTRAINT "leave_quotas_emp_type_year_idx" UNIQUE("employee_id","leave_type","year");