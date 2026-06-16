import fs from 'fs';
import path from 'path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { UserRole } from '@/types/datasheet';

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface DbDatasheet {
  id: number;
  serial_no: string;
  status: 'draft' | 'submitted';
  created_by: number | null;
  updated_by: number | null;
  form_data: Record<string, unknown>;
  claim_no: string | null;
  reg_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAttachment {
  id: number;
  datasheet_id: number;
  doc_type: string;
  file_name: string;
  file_path: string;
  uploaded_by: number | null;
  uploaded_at: string;
}

interface JsonStore {
  users: DbUser[];
  datasheets: DbDatasheet[];
  attachments: DbAttachment[];
  serialCounter: number;
}

const PERSIST_DIR = path.join(process.cwd(), '.persist');
const PERSIST_FILE = path.join(PERSIST_DIR, 'datasheet-db.json');

let pool: Pool | null = null;
let jsonStore: JsonStore | null = null;
let useJson = false;
let initPromise: Promise<void> | null = null;

function loadJsonStore(): JsonStore {
  if (!fs.existsSync(PERSIST_DIR)) {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
  }
  if (fs.existsSync(PERSIST_FILE)) {
    return JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8')) as JsonStore;
  }
  return { users: [], datasheets: [], attachments: [], serialCounter: 0 };
}

function saveJsonStore() {
  if (!jsonStore) return;
  if (!fs.existsSync(PERSIST_DIR)) {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
  }
  fs.writeFileSync(PERSIST_FILE, JSON.stringify(jsonStore, null, 2));
}

async function initPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    useJson = true;
    jsonStore = loadJsonStore();
    return;
  }

  pool = new Pool({ connectionString: url });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin', 'Assessor', 'ReadOnly')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasheets (
      id SERIAL PRIMARY KEY,
      serial_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      claim_no TEXT,
      reg_no TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasheet_attachments (
      id SERIAL PRIMARY KEY,
      datasheet_id INTEGER NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasheets_claim_no ON datasheets (claim_no);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasheets_reg_no ON datasheets (reg_no);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasheets_status ON datasheets (status);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasheets_created_by ON datasheets (created_by);
  `);
}

export async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = initPostgres();
  }
  await initPromise;
}

export function isJsonMode(): boolean {
  return useJson;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  await ensureDb();

  if (useJson && jsonStore) {
    return jsonQuery<T>(text, params);
  }

  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool.query<T>(text, params);
}

function jsonQuery<T extends QueryResultRow>(text: string, params: unknown[]): QueryResult<T> {
  const store = jsonStore!;
  const sql = text.trim().toLowerCase();

  if (sql.startsWith('select count(*)')) {
    if (sql.includes('from users')) {
      return { rows: [{ count: String(store.users.length) }], rowCount: 1 } as unknown as QueryResult<T>;
    }
  }

  if (sql.includes('select id, name, email, role, is_active') && sql.includes('from users where email')) {
    const email = String(params[0]).toLowerCase();
    const user = store.users.find((u) => u.email.toLowerCase() === email);
    return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from users where id')) {
    const id = Number(params[0]);
    const user = store.users.find((u) => u.id === id);
    return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('insert into users')) {
    const [name, email, password_hash, role] = params as [string, string, string, UserRole];
    const existing = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) throw new Error('duplicate key value violates unique constraint');
    const id = store.users.length ? Math.max(...store.users.map((u) => u.id)) + 1 : 1;
    const user: DbUser = {
      id,
      name,
      email,
      password_hash,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    store.users.push(user);
    saveJsonStore();
    return { rows: [user as unknown as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('select') && sql.includes('from users') && sql.includes('order by')) {
    const rows = [...store.users].sort((a, b) => a.name.localeCompare(b.name));
    return { rows: rows as unknown as T[], rowCount: rows.length } as unknown as QueryResult<T>;
  }

  if (sql.includes('insert into datasheets')) {
    store.serialCounter += 1;
    const serial = `DS-${new Date().getFullYear()}-${String(store.serialCounter).padStart(4, '0')}`;
    const [status, created_by, updated_by, form_data, claim_no, reg_no] = params as [
      string,
      number | null,
      number | null,
      Record<string, unknown>,
      string | null,
      string | null,
    ];
    const id = store.datasheets.length ? Math.max(...store.datasheets.map((d) => d.id)) + 1 : 1;
    const now = new Date().toISOString();
    const row: DbDatasheet = {
      id,
      serial_no: serial,
      status: status as 'draft' | 'submitted',
      created_by,
      updated_by,
      form_data,
      claim_no,
      reg_no,
      created_at: now,
      updated_at: now,
    };
    store.datasheets.push(row);
    saveJsonStore();
    return { rows: [row as unknown as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheets where id =')) {
    const id = Number(params[0]);
    const row = store.datasheets.find((d) => d.id === id);
    return { rows: row ? [row as unknown as T] : [], rowCount: row ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('update datasheets set')) {
    const id = Number(params[params.length - 1]);
    const idx = store.datasheets.findIndex((d) => d.id === id);
    if (idx === -1) return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
    const row = store.datasheets[idx];
    if (params.length >= 6) {
      row.status = params[0] as 'draft' | 'submitted';
      row.updated_by = params[1] as number | null;
      row.form_data = params[2] as Record<string, unknown>;
      row.claim_no = params[3] as string | null;
      row.reg_no = params[4] as string | null;
      row.updated_at = new Date().toISOString();
    }
    saveJsonStore();
    return { rows: [row as unknown as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('delete from datasheets where id')) {
    const id = Number(params[0]);
    const before = store.datasheets.length;
    store.datasheets = store.datasheets.filter((d) => d.id !== id);
    store.attachments = store.attachments.filter((a) => a.datasheet_id !== id);
    saveJsonStore();
    return { rows: [], rowCount: before - store.datasheets.length } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheets') && sql.includes('order by')) {
    let rows = [...store.datasheets];
    const status = params.find((p) => p === 'draft' || p === 'submitted');
    const claimNo = params.find((p) => typeof p === 'string' && String(p).includes('%'));
    const regNo = params.find(
      (p, i) => typeof p === 'string' && String(p).includes('%') && p !== claimNo,
    );
    const createdBy = params.find((p) => typeof p === 'number');

    if (status) rows = rows.filter((r) => r.status === status);
    if (typeof claimNo === 'string') {
      const q = claimNo.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => (r.claim_no || '').toLowerCase().includes(q));
    }
    if (typeof regNo === 'string') {
      const q = regNo.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => (r.reg_no || '').toLowerCase().includes(q));
    }
    if (typeof createdBy === 'number') {
      rows = rows.filter((r) => r.created_by === createdBy);
    }
    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return { rows: rows as unknown as T[], rowCount: rows.length } as unknown as QueryResult<T>;
  }

  if (sql.includes('insert into datasheet_attachments')) {
    const [datasheet_id, doc_type, file_name, file_path, uploaded_by] = params as [
      number,
      string,
      string,
      string,
      number | null,
    ];
    const id = store.attachments.length
      ? Math.max(...store.attachments.map((a) => a.id)) + 1
      : 1;
    const row: DbAttachment = {
      id,
      datasheet_id,
      doc_type,
      file_name,
      file_path,
      uploaded_by,
      uploaded_at: new Date().toISOString(),
    };
    store.attachments.push(row);
    saveJsonStore();
    return { rows: [row as unknown as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheet_attachments where datasheet_id')) {
    const datasheetId = Number(params[0]);
    const rows = store.attachments.filter((a) => a.datasheet_id === datasheetId);
    return { rows: rows as unknown as T[], rowCount: rows.length } as unknown as QueryResult<T>;
  }

  return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
}
