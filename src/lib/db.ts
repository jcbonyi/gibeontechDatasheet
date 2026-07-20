import fs from 'fs';
import path from 'path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { DatasheetStatus, UserRole } from '@/types/datasheet';
import { DATASHEET_STATUSES, normalizeStatus } from '@/lib/status';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  status: DatasheetStatus;
  created_by: number | null;
  updated_by: number | null;
  assigned_to: number | null;
  assigned_by: number | null;
  assigned_at: string | null;
  reopen_reason: string | null;
  form_data: Record<string, unknown>;
  claim_no: string | null;
  reg_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDatasheetListRow extends DbDatasheet {
  created_by_name?: string | null;
  assigned_to_name?: string | null;
}

export interface DbAuditEntry {
  id: number;
  datasheet_id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DatasheetListFilters {
  status?: string;
  claimNo?: string;
  regNo?: string;
  assessorId?: number;
  fromDate?: string;
  toDate?: string;
  scopeUserId?: number;
  viewAll?: boolean;
}

interface JsonStore {
  users: DbUser[];
  datasheets: DbDatasheet[];
  audits: DbAuditEntry[];
  serialCounter: number;
  auditCounter: number;
}

const PERSIST_DIR = path.join(process.cwd(), '.persist');
const PERSIST_FILE = path.join(PERSIST_DIR, 'datasheet-db.json');

let pool: Pool | null = null;
let jsonStore: JsonStore | null = null;
let useJson = false;
let useSupabase = false;
let initPromise: Promise<void> | null = null;

function loadJsonStore(): JsonStore {
  if (!fs.existsSync(PERSIST_DIR)) {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
  }
  if (fs.existsSync(PERSIST_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8')) as Partial<JsonStore>;
    return {
      users: parsed.users || [],
      datasheets: (parsed.datasheets || []).map((d) => ({
        ...d,
        created_by: d.created_by ?? null,
        updated_by: d.updated_by ?? null,
        assigned_to: d.assigned_to ?? null,
        assigned_by: d.assigned_by ?? null,
        assigned_at: d.assigned_at ?? null,
        reopen_reason: d.reopen_reason ?? null,
        status: normalizeStatus(d.status || 'instructed'),
      })),
      audits: parsed.audits || [],
      serialCounter: parsed.serialCounter || 0,
      auditCounter: parsed.auditCounter || 0,
    };
  }
  return { users: [], datasheets: [], audits: [], serialCounter: 0, auditCounter: 0 };
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

async function initSupabase(): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  const { error } = await client.from('users').select('id', { count: 'exact', head: true });
  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.message.includes('Could not find the table') ||
      error.message.includes('schema cache')
    ) {
      throw new Error(
        'Supabase tables not found. Run supabase/migrations/001_initial.sql in the Supabase SQL Editor.',
      );
    }
    throw new Error(`Supabase connection failed: ${error.message}`);
  }

  useSupabase = true;
  console.log('[db] Connected to Supabase via REST API');
}

function missingSupabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

function dbConfigError(): string {
  const missing = missingSupabaseEnvVars();
  if (missing.length) {
    return `Database not configured. Add ${missing.join(' and ')} to your Vercel project environment variables (Settings → Environment Variables), then redeploy.`;
  }
  return 'Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or provide DATABASE_URL.';
}

async function initPostgres(): Promise<void> {
  const useLocal = process.env.USE_LOCAL_DB === 'true';

  if (!useLocal) {
    try {
      await initSupabase();
      if (useSupabase) return;
    } catch (err) {
      if (!process.env.DATABASE_URL?.trim()) {
        throw err;
      }
      console.warn('[db] Supabase REST unavailable, trying DATABASE_URL:', err);
    }
  }

  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    if (useLocal || process.env.NODE_ENV === 'development') {
      useJson = true;
      jsonStore = loadJsonStore();
      console.warn(
        '[db] Using local JSON storage (.persist/). Configure Supabase keys or DATABASE_URL.',
      );
      return;
    }
    throw new Error(dbConfigError());
  }

  pool = new Pool({
    connectionString: url,
    ssl: requiresSsl(url) ? { rejectUnauthorized: false } : undefined,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin', 'PrincipalOfficer', 'OperationsManager', 'Assessor')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasheets (
      id SERIAL PRIMARY KEY,
      serial_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'instructed', 'allocated', 'in_progress', 'awaiting_documents',
        'pending_review', 'under_review', 'queried', 'report_issued',
        'on_hold', 'closed', 'cancelled',
        'draft', 'submitted', 'approved'
      )),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      reopen_reason TEXT,
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      claim_no TEXT,
      reg_no TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
  `);
  await pool.query(`
    ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS reopen_reason TEXT;
  `);

  // Migrate legacy statuses + refresh check constraint
  await pool.query(`UPDATE datasheets SET status = 'instructed' WHERE status = 'draft'`);
  await pool.query(`UPDATE datasheets SET status = 'pending_review' WHERE status = 'submitted'`);
  await pool.query(`UPDATE datasheets SET status = 'report_issued' WHERE status = 'approved'`);
  await pool.query(`ALTER TABLE datasheets DROP CONSTRAINT IF EXISTS datasheets_status_check`);
  await pool.query(`
    ALTER TABLE datasheets ADD CONSTRAINT datasheets_status_check
      CHECK (status IN (
        'instructed', 'allocated', 'in_progress', 'awaiting_documents',
        'pending_review', 'under_review', 'queried', 'report_issued',
        'on_hold', 'closed', 'cancelled'
      ))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasheet_audit (
      id SERIAL PRIMARY KEY,
      datasheet_id INTEGER NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasheets_assigned_to ON datasheets (assigned_to);
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

  if (url.includes('supabase.co')) {
    console.log('[db] Connected to Supabase PostgreSQL');
  }
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

  if (useSupabase) {
    return supabaseQuery<T>(text, params);
  }

  if (useJson && jsonStore) {
    return jsonQuery<T>(text, params);
  }

  if (!pool) {
    throw new Error(dbConfigError());
  }
  return pool.query<T>(text, params);
}

async function supabaseQuery<T extends QueryResultRow>(
  text: string,
  params: unknown[],
): Promise<QueryResult<T>> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error('Supabase client not initialized');

  const sql = text.trim().toLowerCase();

  if (sql.startsWith('select count(*)') && sql.includes('from users')) {
    const { count, error } = await client.from('users').select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return { rows: [{ count: String(count || 0) }], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('password_hash') && sql.includes('from users where email')) {
    const email = String(params[0]).toLowerCase();
    const { data, error } = await client
      .from('users')
      .select('id, name, email, role, is_active, password_hash')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data as T] : [], rowCount: data ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from users where id')) {
    const id = Number(params[0]);
    const { data, error } = await client
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data as T] : [], rowCount: data ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('insert into users')) {
    const [name, email, password_hash, role] = params as [string, string, string, UserRole];
    const { data, error } = await client
      .from('users')
      .insert({ name, email, password_hash, role })
      .select('id, name, email, role, is_active')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('duplicate key value violates unique constraint');
      throw new Error(error.message);
    }
    return { rows: [data as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from users') && sql.includes('order by')) {
    const { data, error } = await client
      .from('users')
      .select('id, name, email, role, is_active, created_at')
      .order('name');
    if (error) throw new Error(error.message);
    return { rows: (data || []) as T[], rowCount: data?.length || 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('insert into datasheets')) {
    if (sql.includes('assigned_to')) {
      const [
        serial_no,
        status,
        created_by,
        updated_by,
        form_data,
        claim_no,
        reg_no,
        assigned_to,
        assigned_by,
        assigned_at,
        reopen_reason,
      ] = params;
      const { data, error } = await client
        .from('datasheets')
        .insert({
          serial_no,
          status,
          created_by,
          updated_by,
          form_data,
          claim_no,
          reg_no,
          assigned_to,
          assigned_by,
          assigned_at,
          reopen_reason,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { rows: [data as T], rowCount: 1 } as unknown as QueryResult<T>;
    }

    const [serial_no, status, created_by, updated_by, form_data, claim_no, reg_no] = params as [
      string,
      string,
      number | null,
      number | null,
      Record<string, unknown>,
      string | null,
      string | null,
    ];
    const { data, error } = await client
      .from('datasheets')
      .insert({
        serial_no,
        status,
        created_by,
        updated_by,
        form_data,
        claim_no,
        reg_no,
        assigned_to: null,
        assigned_by: null,
        assigned_at: null,
        reopen_reason: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { rows: [data as T], rowCount: 1 } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheets where id =')) {
    const id = Number(params[0]);
    const { data, error } = await client.from('datasheets').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data as T] : [], rowCount: data ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('update datasheets set')) {
    const id = Number(params[params.length - 1]);
    const { data, error } = await client
      .from('datasheets')
      .update({
        status: params[0],
        updated_by: params[1],
        form_data: params[2],
        claim_no: params[3],
        reg_no: params[4],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { rows: data ? [data as T] : [], rowCount: data ? 1 : 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('delete from datasheets where id')) {
    const id = Number(params[0]);
    const { error, count } = await client
      .from('datasheets')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { rows: [], rowCount: count || 0 } as unknown as QueryResult<T>;
  }

  if (sql.includes('serial_no from datasheets where serial_no like')) {
    const prefix = String(params[0]).replace(/%/g, '');
    const { data, error } = await client
      .from('datasheets')
      .select('serial_no')
      .like('serial_no', `${prefix}%`);
    if (error) throw new Error(error.message);
    return {
      rows: (data || []) as T[],
      rowCount: data?.length || 0,
    } as unknown as QueryResult<T>;
  }

  if (sql.includes('from datasheets') && sql.includes('order by') && !sql.includes('serial_no like')) {
    let q = client
      .from('datasheets')
      .select(
        'id, serial_no, status, created_by, assigned_to, assigned_by, claim_no, reg_no, created_at, updated_at, reopen_reason',
      );

    const status = params.find((p) => typeof p === 'string' && (DATASHEET_STATUSES as string[]).includes(p));
    const claimNo = params.find((p) => typeof p === 'string' && String(p).includes('%'));
    const regNo = params.find(
      (p) => typeof p === 'string' && String(p).includes('%') && p !== claimNo,
    );

    if (status) q = q.eq('status', status as string);
    if (typeof claimNo === 'string') q = q.ilike('claim_no', claimNo as string);
    if (typeof regNo === 'string') q = q.ilike('reg_no', regNo as string);

    const { data, error } = await q.order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data || []) as T[], rowCount: data?.length || 0 } as unknown as QueryResult<T>;
  }

  return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
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
    const [serial_no, status, created_by, updated_by, form_data, claim_no, reg_no] = params as [
      string,
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
      serial_no,
      status: status as DatasheetStatus,
      created_by,
      updated_by,
      assigned_to: null,
      assigned_by: null,
      assigned_at: null,
      reopen_reason: null,
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
    row.status = params[0] as DatasheetStatus;
    row.updated_by = params[1] as number | null;
    row.form_data = params[2] as Record<string, unknown>;
    row.claim_no = params[3] as string | null;
    row.reg_no = params[4] as string | null;
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
    const status = params.find((p) => typeof p === 'string' && (DATASHEET_STATUSES as string[]).includes(p));
    const claimNo = params.find((p) => typeof p === 'string' && String(p).includes('%'));
    const regNo = params.find(
      (p) => typeof p === 'string' && String(p).includes('%') && p !== claimNo,
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

  if (sql.includes('serial_no from datasheets where serial_no like')) {
    const prefix = String(params[0]).replace(/%/g, '');
    const rows = store.datasheets.filter((d) => d.serial_no.startsWith(prefix));
    return {
      rows: rows.map((d) => ({ serial_no: d.serial_no })) as unknown as T[],
      rowCount: rows.length,
    } as unknown as QueryResult<T>;
  }

  return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
}

function enrichDatasheetRows(rows: DbDatasheet[], users: DbUser[]): DbDatasheetListRow[] {
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((row) => ({
    ...row,
    status: normalizeStatus(row.status),
    created_by_name: row.created_by ? userMap.get(row.created_by) || null : null,
    assigned_to_name: row.assigned_to ? userMap.get(row.assigned_to) || null : null,
  }));
}

function filterDatasheetRows(rows: DbDatasheet[], filters: DatasheetListFilters): DbDatasheet[] {
  let result = [...rows];

  if (!filters.viewAll && filters.scopeUserId) {
    result = result.filter(
      (r) => r.created_by === filters.scopeUserId || r.assigned_to === filters.scopeUserId,
    );
  }
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.claimNo) {
    const q = filters.claimNo.toLowerCase();
    result = result.filter((r) => (r.claim_no || '').toLowerCase().includes(q));
  }
  if (filters.regNo) {
    const q = filters.regNo.toLowerCase();
    result = result.filter((r) => (r.reg_no || '').toLowerCase().includes(q));
  }
  if (filters.assessorId) {
    result = result.filter(
      (r) => r.created_by === filters.assessorId || r.assigned_to === filters.assessorId,
    );
  }
  if (filters.fromDate) {
    const from = new Date(filters.fromDate).getTime();
    result = result.filter((r) => new Date(r.updated_at).getTime() >= from);
  }
  if (filters.toDate) {
    const to = new Date(`${filters.toDate}T23:59:59`).getTime();
    result = result.filter((r) => new Date(r.updated_at).getTime() <= to);
  }

  return result.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listDatasheets(filters: DatasheetListFilters): Promise<DbDatasheetListRow[]> {
  await ensureDb();

  if (useJson && jsonStore) {
    const users = jsonStore.users;
    const rows = filterDatasheetRows(jsonStore.datasheets, filters);
    return enrichDatasheetRows(rows, users);
  }

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');

    let q = client.from('datasheets').select('*');
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.claimNo) q = q.ilike('claim_no', `%${filters.claimNo}%`);
    if (filters.regNo) q = q.ilike('reg_no', `%${filters.regNo}%`);
    if (!filters.viewAll && filters.scopeUserId) {
      q = q.or(
        `created_by.eq.${filters.scopeUserId},assigned_to.eq.${filters.scopeUserId}`,
      );
    } else if (filters.assessorId) {
      q = q.or(
        `created_by.eq.${filters.assessorId},assigned_to.eq.${filters.assessorId}`,
      );
    }
    if (filters.fromDate) q = q.gte('updated_at', filters.fromDate);
    if (filters.toDate) q = q.lte('updated_at', `${filters.toDate}T23:59:59`);

    const { data, error } = await q.order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);

    const usersResult = await client.from('users').select('id, name, email, role, is_active, password_hash, created_at');
    const users = (usersResult.data || []) as DbUser[];
    return enrichDatasheetRows((data || []) as DbDatasheet[], users);
  }

  if (!pool) throw new Error(dbConfigError());

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`d.status = $${params.length}`);
  }
  if (filters.claimNo) {
    params.push(`%${filters.claimNo}%`);
    conditions.push(`d.claim_no ILIKE $${params.length}`);
  }
  if (filters.regNo) {
    params.push(`%${filters.regNo}%`);
    conditions.push(`d.reg_no ILIKE $${params.length}`);
  }
  if (!filters.viewAll && filters.scopeUserId) {
    params.push(filters.scopeUserId);
    conditions.push(`(d.created_by = $${params.length} OR d.assigned_to = $${params.length})`);
  } else if (filters.assessorId) {
    params.push(filters.assessorId);
    conditions.push(`(d.created_by = $${params.length} OR d.assigned_to = $${params.length})`);
  }
  if (filters.fromDate) {
    params.push(filters.fromDate);
    conditions.push(`d.updated_at >= $${params.length}`);
  }
  if (filters.toDate) {
    params.push(`${filters.toDate}T23:59:59`);
    conditions.push(`d.updated_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query<DbDatasheet>(
    `SELECT d.* FROM datasheets d ${where} ORDER BY d.updated_at DESC`,
    params,
  );
  const usersResult = await pool.query<DbUser>('SELECT * FROM users');
  return enrichDatasheetRows(result.rows, usersResult.rows);
}

export async function logDatasheetAudit(
  datasheetId: number,
  userId: number | null,
  userName: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await ensureDb();

  if (useJson && jsonStore) {
    const id = jsonStore.auditCounter + 1;
    jsonStore.auditCounter = id;
    jsonStore.audits.push({
      id,
      datasheet_id: datasheetId,
      user_id: userId,
      user_name: userName,
      action,
      details,
      created_at: new Date().toISOString(),
    });
    saveJsonStore();
    return;
  }

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');
    const { error } = await client.from('datasheet_audit').insert({
      datasheet_id: datasheetId,
      user_id: userId,
      user_name: userName,
      action,
      details,
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (!pool) throw new Error(dbConfigError());
  await pool.query(
    `INSERT INTO datasheet_audit (datasheet_id, user_id, user_name, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [datasheetId, userId, userName, action, JSON.stringify(details)],
  );
}

export async function getDatasheetAuditLog(datasheetId: number): Promise<DbAuditEntry[]> {
  await ensureDb();

  if (useJson && jsonStore) {
    return jsonStore.audits
      .filter((a) => a.datasheet_id === datasheetId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');
    const { data, error } = await client
      .from('datasheet_audit')
      .select('*')
      .eq('datasheet_id', datasheetId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as DbAuditEntry[];
  }

  if (!pool) throw new Error(dbConfigError());
  const result = await pool.query<DbAuditEntry>(
    'SELECT * FROM datasheet_audit WHERE datasheet_id = $1 ORDER BY created_at DESC',
    [datasheetId],
  );
  return result.rows;
}

export async function updateDatasheetRecord(
  id: number,
  patch: Partial<
    Pick<
      DbDatasheet,
      | 'status'
      | 'updated_by'
      | 'form_data'
      | 'claim_no'
      | 'reg_no'
      | 'assigned_to'
      | 'assigned_by'
      | 'assigned_at'
      | 'reopen_reason'
    >
  >,
): Promise<DbDatasheet | null> {
  await ensureDb();
  const updated_at = new Date().toISOString();

  if (useJson && jsonStore) {
    const idx = jsonStore.datasheets.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    jsonStore.datasheets[idx] = {
      ...jsonStore.datasheets[idx],
      ...patch,
      updated_at,
    };
    saveJsonStore();
    return jsonStore.datasheets[idx];
  }

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');
    const { data, error } = await client
      .from('datasheets')
      .update({ ...patch, updated_at })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DbDatasheet;
  }

  if (!pool) throw new Error(dbConfigError());
  const fields: string[] = [];
  const values: unknown[] = [];
  Object.entries({ ...patch, updated_at }).forEach(([key, value]) => {
    values.push(key === 'form_data' ? JSON.stringify(value) : value);
    fields.push(`${key} = $${values.length}`);
  });
  values.push(id);
  const result = await pool.query<DbDatasheet>(
    `UPDATE datasheets SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function getActiveUsers(role?: UserRole): Promise<Omit<DbUser, 'password_hash'>[]> {
  await ensureDb();
  const result = await query<Omit<DbUser, 'password_hash'>>(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name',
  );
  let users = result.rows.filter((u) => u.is_active);
  if (role) users = users.filter((u) => u.role === role);
  return users;
}

export async function updateUserRecord(
  id: number,
  patch: Partial<Pick<DbUser, 'name' | 'email' | 'role' | 'is_active' | 'password_hash'>>,
): Promise<Omit<DbUser, 'password_hash'> | null> {
  await ensureDb();

  if (useJson && jsonStore) {
    const idx = jsonStore.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    jsonStore.users[idx] = { ...jsonStore.users[idx], ...patch };
    saveJsonStore();
    const { password_hash: _pw, ...safe } = jsonStore.users[idx];
    return safe;
  }

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');
    const { data, error } = await client
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('id, name, email, role, is_active, created_at')
      .single();
    if (error) throw new Error(error.message);
    return data as Omit<DbUser, 'password_hash'>;
  }

  if (!pool) throw new Error(dbConfigError());
  const fields: string[] = [];
  const values: unknown[] = [];
  Object.entries(patch).forEach(([key, value]) => {
    values.push(value);
    fields.push(`${key} = $${values.length}`);
  });
  if (!fields.length) return null;
  values.push(id);
  const result = await pool.query<Omit<DbUser, 'password_hash'>>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}
     RETURNING id, name, email, role, is_active, created_at`,
    values,
  );
  return result.rows[0] || null;
}

export async function getDatasheetById(id: number): Promise<DbDatasheet | null> {
  const result = await query<DbDatasheet>('SELECT * FROM datasheets WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, status: normalizeStatus(row.status) };
}

function maxSerialSuffix(prefix: string, serials: string[]): number {
  return serials.reduce((highest, serialNo) => {
    if (!serialNo.startsWith(prefix)) return highest;
    const num = Number(serialNo.slice(prefix.length));
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
}

export async function allocateNextSerialNo(): Promise<string> {
  await ensureDb();
  const year = new Date().getFullYear();
  const prefix = `DS-${year}-`;

  if (useSupabase) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client not initialized');
    const { data, error } = await client
      .from('datasheets')
      .select('serial_no')
      .like('serial_no', `${prefix}%`);
    if (error) throw new Error(error.message);
    const next = maxSerialSuffix(prefix, (data || []).map((row) => row.serial_no)) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  if (useJson && jsonStore) {
    const next =
      maxSerialSuffix(
        prefix,
        jsonStore.datasheets.map((d) => d.serial_no),
      ) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  if (!pool) throw new Error(dbConfigError());

  const result = await pool.query<{ serial_no: string }>(
    'SELECT serial_no FROM datasheets WHERE serial_no LIKE $1',
    [`${prefix}%`],
  );
  const next = maxSerialSuffix(prefix, result.rows.map((row) => row.serial_no)) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function isDuplicateSerialError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('datasheets_serial_no_key') ||
      err.message.includes('duplicate key value violates unique constraint'))
  );
}

export async function insertDatasheetRecord(
  row: Omit<DbDatasheet, 'id' | 'created_at' | 'updated_at'>,
): Promise<DbDatasheet> {
  if (useJson && jsonStore) {
    const id = jsonStore.datasheets.length ? Math.max(...jsonStore.datasheets.map((d) => d.id)) + 1 : 1;
    const now = new Date().toISOString();
    const created: DbDatasheet = { ...row, id, created_at: now, updated_at: now };
    jsonStore.datasheets.push(created);
    saveJsonStore();
    return created;
  }

  const result = await query<DbDatasheet>(
    `INSERT INTO datasheets (
      serial_no, status, created_by, updated_by, form_data, claim_no, reg_no,
      assigned_to, assigned_by, assigned_at, reopen_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      row.serial_no,
      row.status,
      row.created_by,
      row.updated_by,
      row.form_data,
      row.claim_no,
      row.reg_no,
      row.assigned_to,
      row.assigned_by,
      row.assigned_at,
      row.reopen_reason,
    ],
  );
  return result.rows[0];
}
