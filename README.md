# GibeonTech Datasheet Capture App

Full-stack web application for **Gibeontech Loss Assessors & Valuers** to digitize the motor claim datasheet.

Runs as a **Node.js server** (`next start`) with user login, Supabase backend, and role-based access.

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, React Hook Form, Zod
- **Backend:** Next.js API routes, JWT auth
- **Database:** [Supabase](https://supabase.com) PostgreSQL (recommended)
- **PDF:** jsPDF + jspdf-autotable

## Features

- Multi-section datasheet form mapped from the paper `GIBEONTECH DATASHEET.pdf`
- **Remarks**, parts lists, and required-documents checklist
- Interactive vehicle damage diagram and digital signature pad
- Datasheet dashboard with search/filter
- User accounts (Admin creates assessors)
- Draft auto-save and submit (logged-in users)
- **Seen By** auto-filled from logged-in user
- Branded PDF export

## Quick Start

### 1. Install dependencies

```bash
cd gibeontechDatasheet
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run `supabase/migrations/001_initial.sql`
3. Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
JWT_SECRET=your-long-random-secret
```

Get **DATABASE_URL** from Supabase → **Project Settings** → **Database** → **Connection string** → **Transaction pooler** (port 6543).

Get **SUPABASE_SERVICE_ROLE_KEY** from **Project Settings** → **API** (keep secret, server-only).

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — create the admin account at `/login` on first visit.

### Local dev without Supabase (optional)

Set `USE_LOCAL_DB=true` in `.env.local` to use `.persist/datasheet-db.json` instead.

## Production (Node server)

```bash
npm run build
npm start
```

Use Supabase `DATABASE_URL` in production. Run `npm run db:migrate` once to ensure tables exist (or use the SQL migration file).

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/bootstrap` | Create first admin |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/datasheets` | List / create |
| GET/PATCH/DELETE | `/api/datasheets/:id` | Read / update / delete |
| GET/POST | `/api/users` | List / create users (Admin) |

## Source Document

The form fields are based on `GIBEONTECH DATASHEET.pdf` in this folder.
