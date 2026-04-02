# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **Zing CRM** application — a full-stack CRM for sales teams with contact management, deal pipelines, company tracking, and activity logging.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter (frontend), Express (backend)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── zing-crm/           # React + Vite CRM frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
│   └── src/seed.ts         # CRM seed data script
└── ...
```

## CRM Features

- **Dashboard** — Summary metrics (contacts, deals, pipeline value), quick links
- **Contacts** — CRUD with search, status filtering (lead/prospect/customer/churned), company linking
- **Companies** — CRUD with industry, website, size fields
- **Deals** — Pipeline stages (prospecting/qualification/proposal/negotiation/closed_won/closed_lost), values, linked contacts & companies
- **Activities** — Log calls, emails, meetings, notes, tasks — linked to contacts and deals

## Database Schema

- `companies` — name, industry, website, size, notes
- `contacts` — firstName, lastName, email, phone, companyId (FK), status, notes
- `deals` — title, value (numeric), stage, contactId (FK), companyId (FK), closeDate, notes
- `activities` — type, title, description, contactId (FK), dealId (FK), dueDate, completed

## API Endpoints

All under `/api` prefix:
- `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id`
- `GET /contacts/recent` — recently added contacts
- `GET/POST /companies`, `GET/PATCH/DELETE /companies/:id`
- `GET/POST /deals`, `GET/PATCH/DELETE /deals/:id`
- `GET /deals/by-stage` — deals grouped by pipeline stage
- `GET/POST /activities`, `PATCH/DELETE /activities/:id`
- `GET /dashboard/summary` — CRM dashboard metrics
- `POST /generate-pdf` — generate devis PDF via pdfkit (pure Node.js)
- `GET/POST /suivi/:contactId` — interaction timeline (local PG)
- `GET/PUT /client-perso/:contactId` — client personalization (local PG)
- `POST /webhook/forminator` — **public** WordPress Forminator webhook; creates Supabase contact from form submission. Accepts `form_id` 8148 (Pro) or 8174 (Particulier). Fields: name-1, name-2, phone-1, email-1, text-1 (société Pro only), text-3, date-1, textarea-1. Supports both flat JSON and nested `fields` object.

## Running

- **API Server**: `pnpm --filter @workspace/api-server run dev`
- **Frontend**: `pnpm --filter @workspace/zing-crm run dev`
- **Seed DB**: `pnpm --filter @workspace/scripts run seed`
- **Push DB schema**: `pnpm --filter @workspace/db run push`
- **Run codegen**: `pnpm --filter @workspace/api-spec run codegen`
