import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";
import { companiesTable } from "./companies";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }),
  stage: text("stage", {
    enum: ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"],
  }).notNull().default("prospecting"),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  closeDate: text("close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
