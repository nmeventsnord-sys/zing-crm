import { db, companiesTable, contactsTable, dealsTable, activitiesTable } from "@workspace/db";

async function seed() {
  console.log("Seeding Zing CRM...");

  // Seed companies
  const [acme, nova, peak] = await db
    .insert(companiesTable)
    .values([
      { name: "Acme Corp", industry: "Technology", website: "https://acme.example.com", size: "201-500", notes: "Long-standing enterprise client" },
      { name: "Nova Ventures", industry: "Finance", website: "https://nova.example.com", size: "11-50", notes: "Fast-growing fintech startup" },
      { name: "Peak Solutions", industry: "Consulting", website: "https://peak.example.com", size: "51-200", notes: "Regional consulting firm" },
    ])
    .returning();

  // Seed contacts
  const [alice, bob, carol, dan] = await db
    .insert(contactsTable)
    .values([
      { firstName: "Alice", lastName: "Johnson", email: "alice@acme.example.com", phone: "+1-555-0101", companyId: acme.id, status: "customer", notes: "Decision maker for enterprise renewals" },
      { firstName: "Bob", lastName: "Martinez", email: "bob@nova.example.com", phone: "+1-555-0102", companyId: nova.id, status: "prospect", notes: "Interested in advanced analytics tier" },
      { firstName: "Carol", lastName: "Chen", email: "carol@peak.example.com", phone: "+1-555-0103", companyId: peak.id, status: "lead", notes: "Met at SaaS Summit 2024" },
      { firstName: "Dan", lastName: "Williams", email: "dan@acme.example.com", phone: "+1-555-0104", companyId: acme.id, status: "customer", notes: "Technical lead, manages integrations" },
    ])
    .returning();

  // Seed deals
  const [d1, d2, d3] = await db
    .insert(dealsTable)
    .values([
      { title: "Acme Enterprise Renewal", value: "48000", stage: "negotiation", contactId: alice.id, companyId: acme.id, closeDate: "2026-04-30", notes: "Annual renewal, potential upsell to premium tier" },
      { title: "Nova Analytics Package", value: "12000", stage: "proposal", contactId: bob.id, companyId: nova.id, closeDate: "2026-05-15", notes: "3-month pilot agreement" },
      { title: "Peak Consulting Onboarding", value: "6500", stage: "qualification", contactId: carol.id, companyId: peak.id, closeDate: "2026-06-01", notes: "Initial contract pending legal review" },
    ])
    .returning();

  // Seed activities
  await db.insert(activitiesTable).values([
    { type: "call", title: "Renewal discussion call", description: "Discussed pricing and renewal terms for 2026", contactId: alice.id, dealId: d1.id, dueDate: new Date("2026-04-10T14:00:00Z"), completed: true },
    { type: "email", title: "Proposal sent", description: "Sent detailed analytics package proposal", contactId: bob.id, dealId: d2.id, dueDate: new Date("2026-04-05T09:00:00Z"), completed: true },
    { type: "meeting", title: "Discovery call", description: "Initial discovery call to understand requirements", contactId: carol.id, dealId: d3.id, dueDate: new Date("2026-04-15T11:00:00Z"), completed: false },
    { type: "task", title: "Follow up on contract", description: "Check legal status of Peak onboarding contract", contactId: carol.id, dealId: d3.id, dueDate: new Date("2026-04-18T09:00:00Z"), completed: false },
    { type: "note", title: "Integration requirements noted", description: "Dan shared detailed list of required API integrations", contactId: dan.id, dealId: d1.id, completed: true },
  ]);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
