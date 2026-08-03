CREATE TABLE "crash_monuments" (
	"id" text PRIMARY KEY,
	"garden_id" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crash_monuments_garden_id_idx" ON "crash_monuments" ("garden_id");