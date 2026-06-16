# GibeonTech Datasheet Capture App

Full-stack web application for **Gibeontech Loss Assessors & Valuers** to digitize the motor claim datasheet, including Advice to Repairer, Advice to Insurer, and a required-documents checklist.

Runs as a **Node.js server** (`next start`) with no login required.

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, React Hook Form, Zod
- **Backend:** Next.js API routes on Node.js
- **Storage:** Local JSON file (default) or optional PostgreSQL
- **PDF:** jsPDF + jspdf-autotable

## Features

- Multi-section datasheet form mapped from the paper `GIBEONTECH DATASHEET.pdf`
- **Advice to Repairer** and **Advice to Insurer** text sections
- **Required documents checklist:** Claim Form, Police Abstract, Logbook Copy, Driver's Statement, Repair Quotation
- Interactive vehicle damage diagram and digital signature pad
- Datasheet register with search/filter
- Draft auto-save every 30 seconds
- Branded PDF export

## Quick Start

### 1. Install dependencies

```bash
cd gibeontechDatasheet
npm install
```

### 2. Environment (optional)

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

By default, data is stored in `.persist/datasheet-db.json` on the server filesystem. No database setup is required.

To use PostgreSQL instead, set:

```
DATABASE_URL=postgres://user:password@127.0.0.1:5432/gibeontech_datasheet
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you go straight to the datasheet register.

## Production (Node server)

Build and run the standalone Node server:

```bash
npm run build
npm start
```

The app listens on port **3000** by default (`PORT` env var to change).

For production on a VPS or similar:

1. Keep `.persist/` on persistent disk (or set `DATABASE_URL` to PostgreSQL).
2. Use **PM2**, **systemd**, or Docker to keep `npm start` running.
3. Put **Nginx** or **Caddy** in front for HTTPS.

### Optional database migration

```bash
npm run db:migrate
```

Tables are also created automatically on first API request when using PostgreSQL.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/datasheets` | List / create |
| GET/PATCH/DELETE | `/api/datasheets/:id` | Read / update / delete |

## Source Document

The form fields are based on `GIBEONTECH DATASHEET.pdf` in this folder (GibeonTech Loss Assessors motor claim datasheet).
