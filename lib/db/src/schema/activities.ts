import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";
import { dealsTable } from "./deals";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["call", "email", "meeting", "note", "task"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
