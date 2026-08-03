import { doublePrecision, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const crashMonuments = pgTable(
  "crash_monuments",
  {
    id: text().primaryKey(),
    gardenId: text("garden_id").notNull(),
    x: doublePrecision().notNull(),
    z: doublePrecision().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("crash_monuments_garden_id_idx").on(table.gardenId)],
);
