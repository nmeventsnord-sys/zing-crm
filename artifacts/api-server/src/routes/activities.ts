import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, activitiesTable, contactsTable, dealsTable } from "@workspace/db";
import {
  ListActivitiesQueryParams,
  CreateActivityBody,
  UpdateActivityParams,
  UpdateActivityBody,
  UpdateActivityResponse,
  DeleteActivityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getActivitySelect() {
  return {
    id: activitiesTable.id,
    type: activitiesTable.type,
    title: activitiesTable.title,
    description: activitiesTable.description,
    contactId: activitiesTable.contactId,
    contactName: sql<string | null>`CONCAT(${contactsTable.firstName}, ' ', ${contactsTable.lastName})`,
    dealId: activitiesTable.dealId,
    dealTitle: dealsTable.title,
    dueDate: activitiesTable.dueDate,
    completed: activitiesTable.completed,
    createdAt: activitiesTable.createdAt,
    updatedAt: activitiesTable.updatedAt,
  };
}

router.get("/activities", async (req, res): Promise<void> => {
  const query = ListActivitiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { contactId, dealId, type } = query.data;

  const conditions = [];
  if (contactId) conditions.push(eq(activitiesTable.contactId, contactId));
  if (dealId) conditions.push(eq(activitiesTable.dealId, dealId));
  if (type) conditions.push(eq(activitiesTable.type, type as "call" | "email" | "meeting" | "note" | "task"));

  const activities = await db
    .select(getActivitySelect())
    .from(activitiesTable)
    .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
    .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activitiesTable.createdAt));

  res.json(activities);
});

router.post("/activities", async (req, res): Promise<void> => {
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      ...parsed.data,
      completed: parsed.data.completed ?? false,
    })
    .returning();

  const [result] = await db
    .select(getActivitySelect())
    .from(activitiesTable)
    .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
    .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
    .where(eq(activitiesTable.id, activity.id));

  res.status(201).json(result);
});

router.patch("/activities/:id", async (req, res): Promise<void> => {
  const params = UpdateActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(activitiesTable)
    .set(parsed.data)
    .where(eq(activitiesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const [result] = await db
    .select(getActivitySelect())
    .from(activitiesTable)
    .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
    .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
    .where(eq(activitiesTable.id, params.data.id));

  res.json(UpdateActivityResponse.parse(result));
});

router.delete("/activities/:id", async (req, res): Promise<void> => {
  const params = DeleteActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(activitiesTable)
    .where(eq(activitiesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
