import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, gte, and } from "drizzle-orm";
import { db, contactsTable, companiesTable } from "@workspace/db";
import {
  ListContactsQueryParams,
  CreateContactBody,
  GetContactParams,
  GetContactResponse,
  UpdateContactParams,
  UpdateContactBody,
  UpdateContactResponse,
  DeleteContactParams,
  GetRecentContactsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts", async (req, res): Promise<void> => {
  const query = ListContactsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, status, companyId } = query.data;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(contactsTable.firstName, `%${search}%`),
        ilike(contactsTable.lastName, `%${search}%`),
        ilike(contactsTable.email, `%${search}%`)
      )
    );
  }
  if (status) {
    conditions.push(eq(contactsTable.status, status as "lead" | "prospect" | "customer" | "churned"));
  }
  if (companyId) {
    conditions.push(eq(contactsTable.companyId, companyId));
  }

  const contacts = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      notes: contactsTable.notes,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contactsTable.createdAt));

  res.json(contacts);
});

router.get("/contacts/recent", async (req, res): Promise<void> => {
  const query = GetRecentContactsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 5;

  const contacts = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      notes: contactsTable.notes,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .orderBy(desc(contactsTable.createdAt))
    .limit(limit);

  res.json(contacts);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contact] = await db
    .insert(contactsTable)
    .values(parsed.data)
    .returning();

  const [result] = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      notes: contactsTable.notes,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .where(eq(contactsTable.id, contact.id));

  res.status(201).json(GetContactResponse.parse(result));
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      notes: contactsTable.notes,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .where(eq(contactsTable.id, params.data.id));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(GetContactResponse.parse(contact));
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const params = UpdateContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(contactsTable)
    .set(parsed.data)
    .where(eq(contactsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const [result] = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      notes: contactsTable.notes,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .where(eq(contactsTable.id, params.data.id));

  res.json(UpdateContactResponse.parse(result));
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(contactsTable)
    .where(eq(contactsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
