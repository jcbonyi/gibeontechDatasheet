import fs from 'fs';
import path from 'path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

export interface DbDatasheet {
  id: number;
  serial_no: string;
  status: 'draft' | 'submitted';
  form_data: Record<string, unknown>;
  claim_no: string | null;
  reg_no: string | null;
  created_at: string;
  updated_at: string;
}

interface JsonStore {
  datasheets: DbDatasheet[];
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
    const parsed = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8')) as Partial<JsonStore>;
    return {
      datasheets: parsed.datasheets || [],
      serialCounter: parsed.serialCounter || 0,
    };
  }
  return { datasheets: [], serialCounter: 0 };
}

function saveJsonStore() {
  if (!jsonStore) return;
  if (!fs.existsSync(PERSIST_DIR)) {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
  }
  fs.writeFileSync(PERSIST_FILE, JSON.stringify(jsonStore, null, 2));
}

function requiresSsl(connectionString: string): boolean {
  if (process.env.PGSSLMODE === 'require') return true;
  if (/sslmode=require/i.test(connectionString)) return true;
  return /neon\.tech|supabase\.co|render\.com|railway\.app/i.test(connectionString);
}

async function initPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    useJson = true;
    jsonStore = loadJsonStore();
    return;
  }

  pool = new Pool({
    connectionString: url,
    ssl: requiresSsl(url) ? { rejectUnauthorized: false } : undefined,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasheets (
      id SERIAL PRIMARY KEY,
      serial_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      claim_no TEXT,
      reg_no TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
}

export async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = initPostgres().catch((err) => {
      initPromise = null;
      throw err;
    });
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

  if (sql.includes('insert into datasheets')) {
    const [serial_no, status, form_data, claim_no, reg_no] = params as [
      string,
      string,
      Record<string, unknown>,
      string | null,
      string | null,
    ];
    const id = store.datasheets.length ? Math.max(...store.datasheets.map((d) => d.id)) + 1 : 1;
    const now = new Date().toISOString();
    const row: DbDatasheet = {
      id,
      serial_no,
      status: status as 'draft' | 'submitted',
      form_data,
      claim_no,
      reg_no,
      created_at: now,
      updated_at: now,
    };
    store.datasheets.push(row);
    const counter = Number(serial_no.split('-').pop());
    if (!Number.isNaN(counter)) {
      store.serialCounter = Math.max(store.serialCounter, counter);
    }
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
    row.status = params[0] as 'draft' | 'submitted';
    row.form_data = params[1] as Record<string, unknown>;
    row.claim_no = params[2] as string | null;
    row.reg_no = params[3] as string | null;
    row.updated_at = new Date().toISOString();
    saveJsonStore();
    return { rows: [row as unknown as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('delete from datasheets where id')) {
    const id = Number(params[0]);
    const before = store.datasheets.length;
    store.datasheets = store.datasheets.filter((d) => d.id !== id);
    saveJsonStore();
    return { rows: [], rowCount: before - store.datasheets.length } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheets') && sql.includes('order by')) {
    let rows = [...store.datasheets];
    const status = params.find((p) => p === 'draft' || p === 'submitted');
    const claimNo = params.find((p) => typeof p === 'string' && String(p).includes('%'));
    const regNo = params.find(
      (p) => typeof p === 'string' && String(p).includes('%') && p !== claimNo,
    );

    if (status) rows = rows.filter((r) => r.status === status);
    if (typeof claimNo === 'string') {
      const q = claimNo.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => (r.claim_no || '').toLowerCase().includes(q));
    }
    if (typeof regNo === 'string') {
      const q = regNo.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => (r.reg_no || '').toLowerCase().includes(q));
    }
    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return { rows: rows as unknown as T[], rowCount: rows.length } as unknown as QueryResult<T>;
  }

  if (sql.includes('serial_no from datasheets where serial_no like')) {
    const prefix = String(params[0]).replace(/%/g, '');
    const rows = store.datasheets
      .filter((d) => d.serial_no.startsWith(prefix))
      .sort((a, b) => b.id - a.id);
    return {
      rows: rows.length ? [{ serial_no: rows[0].serial_no } as unknown as T] : [],
      rowCount: rows.length ? 1 : 0,
    } as unknown as QueryResult<T>;
  }

  return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
}
