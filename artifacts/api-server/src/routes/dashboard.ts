import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { db, contactsTable, companiesTable, dealsTable, activitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [totalContacts] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(contactsTable);

  const [totalCompanies] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(companiesTable);

  const [totalDeals] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(dealsTable);

  const [pipelineRow] = await db
    .select({ value: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS FLOAT)), 0)` })
    .from(dealsTable)
    .where(
      sql`${dealsTable.stage} NOT IN ('closed_won', 'closed_lost')`
    );

  const [wonRow] = await db
    .select({ value: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS FLOAT)), 0)` })
    .from(dealsTable)
    .where(eq(dealsTable.stage, "closed_won"));

  const [openActivities] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(activitiesTable)
    .where(eq(activitiesTable.completed, false));

  const [newContactsThisMonth] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(contactsTable)
    .where(
      and(
        gte(contactsTable.createdAt, startOfMonth),
        lte(contactsTable.createdAt, endOfMonth)
      )
    );

  const [dealsClosingThisMonth] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(dealsTable)
    .where(
      and(
        gte(dealsTable.closeDate, startOfMonth.toISOString().slice(0, 10)),
        lte(dealsTable.closeDate, endOfMonth.toISOString().slice(0, 10)),
        sql`${dealsTable.stage} NOT IN ('closed_won', 'closed_lost')`
      )
    );

  res.json({
    totalContacts: totalContacts.count,
    totalCompanies: totalCompanies.count,
    totalDeals: totalDeals.count,
    pipelineValue: pipelineRow.value,
    wonDealsValue: wonRow.value,
    openActivities: openActivities.count,
    newContactsThisMonth: newContactsThisMonth.count,
    dealsClosingThisMonth: dealsClosingThisMonth.count,
  });
});

export default router;
