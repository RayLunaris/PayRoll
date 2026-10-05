ALTER TABLE "social_comments" DROP CONSTRAINT "social_comments_post_id_social_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "social_comments" DROP CONSTRAINT "social_comments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "social_likes" DROP CONSTRAINT "social_likes_post_id_social_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "social_likes" DROP CONSTRAINT "social_likes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attendances_date" ON "attendances" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attendances_location" ON "attendances" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_department" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_user_id" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_is_active" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payrolls_period" ON "payrolls" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payrolls_employee" ON "payrolls" USING btree ("employee_id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_name_unique" UNIQUE("name");