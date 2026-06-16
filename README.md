# GibeonTech Datasheet Capture App

Full-stack web application for **Gibeontech Loss Assessors & Valuers** to digitize the motor claim datasheet, including Advice to Repairer, Advice to Insurer, and a required-documents checklist.

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, React Hook Form, Zod
- **Backend:** Next.js API routes, JWT auth, PostgreSQL (JSON file fallback for local dev)
- **PDF:** jsPDF + jspdf-autotable

## Features

- Multi-section datasheet form mapped from the paper `GIBEONTECH DATASHEET.pdf`
- **Advice to Repairer** and **Advice to Insurer** text sections
- **Required documents checklist:** Claim Form, Police Abstract, Logbook Copy, Driver's Statement
- Interactive vehicle damage diagram and digital signature pad
- Datasheet register with search/filter
- Role-based access: Admin, Assessor, ReadOnly
- Draft auto-save every 30 seconds
- Branded PDF export

## Quick Start

### 1. Install dependencies

```bash
cd gibeontechDatasheet
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

For local development without PostgreSQL, leave `DATABASE_URL` empty — data persists to `.persist/datasheet-db.json`.

With PostgreSQL:

```
DATABASE_URL=postgres://user:password@127.0.0.1:5432/gibeontech_datasheet
JWT_SECRET=your-secret-key
UPLOAD_DIR=./uploads
```

### 3. Initialize database (optional)

```bash
npm run db:migrate
```

Tables are also created automatically on first API request.

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Bootstrap admin

On first visit, go to `/login` and create the administrator account when prompted.

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Manage users, view/edit all datasheets |
| **Assessor** | Create and edit own datasheets |
| **ReadOnly** | View datasheets only |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/bootstrap` | Create first admin |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/datasheets` | List / create |
| GET/PATCH/DELETE | `/api/datasheets/:id` | Read / update / delete |
| POST | `/api/upload` | Upload checklist document |
| GET/POST | `/api/users` | List / create users (Admin) |

## Production

```bash
npm run build
npm start
```

Use a real PostgreSQL instance in production. Set a strong `JWT_SECRET` and configure `UPLOAD_DIR` on persistent storage.

## Source Document

The form fields are based on `GIBEONTECH DATASHEET.pdf` in this folder (GibeonTech Loss Assessors motor claim datasheet).
