import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { WorkspaceData } from "@/lib/types";

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    ownerKey: varchar("owner_key", { length: 128 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 400 }).notNull().default(""),
    isTemplate: boolean("is_template").notNull().default(false),
    data: jsonb("data").$type<WorkspaceData>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("workspaces_owner_updated_idx").on(table.ownerKey, table.updatedAt)],
);

export const calculations = pgTable(
  "calculations",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    ownerKey: varchar("owner_key", { length: 128 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    expression: varchar("expression", { length: 512 }).notNull(),
    result: varchar("result", { length: 400 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("calculations_owner_created_idx").on(table.ownerKey, table.createdAt)],
);
