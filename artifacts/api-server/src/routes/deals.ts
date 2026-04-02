import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, dealsTable, contactsTable, companiesTable } from "@workspace/db";
import {
  ListDealsQueryParams,
  CreateDealBody,
  GetDealParams,
  GetDealResponse,
  UpdateDealParams,
  UpdateDealBody,
  UpdateDealResponse,
  DeleteDealParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getDealSelect() {
  return {
    id: dealsTable.id,
    title: dealsTable.title,
    value: sql<number | null>`CAST(${dealsTable.value} AS FLOAT)`,
    stage: dealsTable.stage,
    contactId: dealsTable.contactId,
    contactName: sql<string | null>`CONCAT(${contactsTable.firstName}, ' ', ${contactsTable.lastName})`,
    companyId: dealsTable.companyId,
    companyName: companiesTable.name,
    closeDate: dealsTable.closeDate,
    notes: dealsTable.notes,
    createdAt: dealsTable.createdAt,
    updatedAt: dealsTable.updatedAt,
  };
}

router.get("/deals", async (req, res): Promise<void> => {
  const query = ListDealsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { stage, contactId, companyId } = query.data;

  const conditions = [];
  if (stage) conditions.push(eq(dealsTable.stage, stage as "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"));
  if (contactId) conditions.push(eq(dealsTable.contactId, contactId));
  if (companyId) conditions.push(eq(dealsTable.companyId, companyId));

  const deals = await db
    .select(getDealSelect())
    .from(dealsTable)
    .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
    .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dealsTable.createdAt));

  res.json(deals);
});

router.get("/deals/by-stage", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      stage: dealsTable.stage,
      count: sql<number>`COUNT(*)::int`,
      totalValue: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS FLOAT)), 0)`,
    })
    .from(dealsTable)
    .groupBy(dealsTable.stage)
    .orderBy(dealsTable.stage);

  res.json(rows);
});

router.post("/deals", async (req, res): Promise<void> => {
  const parsed = CreateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const insertData: Record<string, unknown> = { ...parsed.data };
  if (insertData.value !== undefined && insertData.value !== null) {
    insertData.value = String(insertData.value);
  }

  const [deal] = await db
    .insert(dealsTable)
    .values(insertData as Parameters<typeof db.insert>[0] extends infer T ? T : never)
    .returning();

  const [result] = await db
    .select(getDealSelect())
    .from(dealsTable)
    .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
    .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
    .where(eq(dealsTable.id, deal.id));

  res.status(201).json(GetDealResponse.parse(result));
});

router.get("/deals/:id", async (req, res): Promise<void> => {
  const params = GetDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select(getDealSelect())
    .from(dealsTable)
    .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
    .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
    .where(eq(dealsTable.id, params.data.id));

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.json(GetDealResponse.parse(deal));
});

router.patch("/deals/:id", async (req, res): Promise<void> => {
  const params = UpdateDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.value !== undefined && updateData.value !== null) {
    updateData.value = String(updateData.value);
  }

  const [updated] = await db
    .update(dealsTable)
    .set(updateData as Parameters<typeof db.update>[0] extends infer T ? T : never)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const [result] = await db
    .select(getDealSelect())
    .from(dealsTable)
    .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
    .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
    .where(eq(dealsTable.id, params.data.id));

  res.json(UpdateDealResponse.parse(result));
});

router.delete("/deals/:id", async (req, res): Promise<void> => {
  const params = DeleteDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(dealsTable)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
