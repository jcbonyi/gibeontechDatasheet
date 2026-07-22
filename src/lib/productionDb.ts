import fs from 'fs';
import path from 'path';
import { ensureDb, isJsonMode, isSupabaseMode, query } from '@/lib/db';
import { getSupabaseAdmin } from '@/lib/supabase';
import { amountWithoutVat, normalizeAssignment, VAT_RATE, type ProductionStatus } from '@/lib/productionConfig';

export interface DbInsurer {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DbProductionEntry {
  id: number;
  production_date: string;
  insurer_id: number;
  registration_number: string;
  assignment: string | null;
  amount: number;
  amount_without_vat: number;
  done_by_user_id: number | null;
  seen_by_user_id: number | null;
  instructed_by_user_id: number | null;
  remarks: string | null;
  status: ProductionStatus;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  insurer_name?: string | null;
  done_by_name?: string | null;
  seen_by_name?: string | null;
  instructed_by_name?: string | null;
  created_by_name?: string | null;
}

export interface ProductionListFilters {
  fromDate?: string;
  toDate?: string;
  insurerId?: number;
  doneByUserId?: number;
  seenByUserId?: number;
  instructedByUserId?: number;
  registrationNumber?: string;
  status?: string;
  q?: string;
  createdByUserId?: number;
}

export interface DbProductionTarget {
  id: number;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_key: string;
  target_jobs: number;
  target_amount: number;
  created_at: string;
}

export interface DbAppNotification {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

interface ProductionStore {
  insurers: DbInsurer[];
  entries: DbProductionEntry[];
  targets: DbProductionTarget[];
  settings: Record<string, string>;
  notifications: DbAppNotification[];
  resetTokens: {
    id: number;
    user_id: number;
    token_hash: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  }[];
  insurerCounter: number;
  entryCounter: number;
  targetCounter: number;
  notificationCounter: number;
  resetCounter: number;
}

const PERSIST_DIR = path.join(process.cwd(), '.persist');
const PERSIST_FILE = path.join(PERSIST_DIR, 'production-db.json');

let store: ProductionStore | null = null;

function loadStore(): ProductionStore {
  if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR, { recursive: true });
  if (fs.existsSync(PERSIST_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8')) as Partial<ProductionStore>;
    return {
      insurers: parsed.insurers || [],
      entries: parsed.entries || [],
      targets: parsed.targets || [],
      settings: parsed.settings || { vat_rate: String(VAT_RATE) },
      notifications: parsed.notifications || [],
      resetTokens: parsed.resetTokens || [],
      insurerCounter: parsed.insurerCounter || 0,
      entryCounter: parsed.entryCounter || 0,
      targetCounter: parsed.targetCounter || 0,
      notificationCounter: parsed.notificationCounter || 0,
      resetCounter: parsed.resetCounter || 0,
    };
  }
  return {
    insurers: [],
    entries: [],
    targets: [],
    settings: { vat_rate: String(VAT_RATE) },
    notifications: [],
    resetTokens: [],
    insurerCounter: 0,
    entryCounter: 0,
    targetCounter: 0,
    notificationCounter: 0,
    resetCounter: 0,
  };
}

function saveStore() {
  if (!store) return;
  if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR, { recursive: true });
  fs.writeFileSync(PERSIST_FILE, JSON.stringify(store, null, 2));
}

function getStore(): ProductionStore {
  if (!store) store = loadStore();
  return store;
}

function num(v: unknown): number {
  return Number(v) || 0;
}

function dateOnly(v: string | Date | null | undefined): string {
  if (!v) return '';
  return String(v).slice(0, 10);
}

async function userNameMap(): Promise<Map<number, string>> {
  const result = await query<{ id: number; name: string }>(
    'SELECT id, name FROM users ORDER BY name',
  );
  return new Map(result.rows.map((u) => [u.id, u.name]));
}

function enrichEntry(
  row: DbProductionEntry,
  insurers: Map<number, string>,
  users: Map<number, string>,
): DbProductionEntry {
  return {
    ...row,
    production_date: dateOnly(row.production_date),
    assignment: row.assignment ?? null,
    amount: num(row.amount),
    amount_without_vat: num(row.amount_without_vat),
    insurer_name: insurers.get(row.insurer_id) || row.insurer_name || null,
    done_by_name: row.done_by_user_id ? users.get(row.done_by_user_id) || null : null,
    seen_by_name: row.seen_by_user_id ? users.get(row.seen_by_user_id) || null : null,
    instructed_by_name: row.instructed_by_user_id
      ? users.get(row.instructed_by_user_id) || null
      : null,
    created_by_name: row.created_by ? users.get(row.created_by) || null : null,
  };
}

export async function getVatRate(): Promise<number> {
  await ensureDb();
  if (isJsonMode()) {
    const rate = Number(getStore().settings.vat_rate);
    return Number.isFinite(rate) ? rate : VAT_RATE;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) return VAT_RATE;
    const { data } = await client
      .from('production_settings')
      .select('value')
      .eq('key', 'vat_rate')
      .maybeSingle();
    const rate = Number(data?.value);
    return Number.isFinite(rate) ? rate : VAT_RATE;
  }
  try {
    const result = await query<{ value: string }>(
      `SELECT value FROM production_settings WHERE key = 'vat_rate'`,
    );
    const rate = Number(result.rows[0]?.value);
    return Number.isFinite(rate) ? rate : VAT_RATE;
  } catch {
    return VAT_RATE;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureDb();
  if (isJsonMode()) {
    getStore().settings[key] = value;
    saveStore();
    return;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client.from('production_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return;
  }
  await query(
    `INSERT INTO production_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

export async function listInsurers(activeOnly = false): Promise<DbInsurer[]> {
  await ensureDb();
  if (isJsonMode()) {
    let rows = [...getStore().insurers];
    if (activeOnly) rows = rows.filter((i) => i.is_active);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    let q = client.from('insurers').select('*').order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as DbInsurer[];
  }
  const result = await query<DbInsurer>(
    activeOnly
      ? `SELECT * FROM insurers WHERE is_active = TRUE ORDER BY name`
      : `SELECT * FROM insurers ORDER BY name`,
  );
  return result.rows;
}

export async function upsertInsurer(input: {
  id?: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
}): Promise<DbInsurer> {
  await ensureDb();
  const name = input.name.trim();
  if (!name) throw new Error('Insurer name is required');

  if (isJsonMode()) {
    const s = getStore();
    if (input.id) {
      const idx = s.insurers.findIndex((i) => i.id === input.id);
      if (idx < 0) throw new Error('Insurer not found');
      s.insurers[idx] = {
        ...s.insurers[idx],
        name,
        contact_person: input.contact_person?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        is_active: input.is_active ?? s.insurers[idx].is_active,
      };
      saveStore();
      return s.insurers[idx];
    }
    const id = s.insurerCounter + 1;
    s.insurerCounter = id;
    const row: DbInsurer = {
      id,
      name,
      contact_person: input.contact_person?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
    };
    s.insurers.push(row);
    saveStore();
    return row;
  }

  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const payload = {
      name,
      contact_person: input.contact_person?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      is_active: input.is_active ?? true,
    };
    if (input.id) {
      const { data, error } = await client
        .from('insurers')
        .update(payload)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbInsurer;
    }
    const { data, error } = await client.from('insurers').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data as DbInsurer;
  }

  if (input.id) {
    const result = await query<DbInsurer>(
      `UPDATE insurers SET name=$1, contact_person=$2, email=$3, phone=$4, is_active=COALESCE($5, is_active)
       WHERE id=$6 RETURNING *`,
      [
        name,
        input.contact_person?.trim() || null,
        input.email?.trim() || null,
        input.phone?.trim() || null,
        input.is_active ?? null,
        input.id,
      ],
    );
    if (!result.rows[0]) throw new Error('Insurer not found');
    return result.rows[0];
  }
  const result = await query<DbInsurer>(
    `INSERT INTO insurers (name, contact_person, email, phone, is_active)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      name,
      input.contact_person?.trim() || null,
      input.email?.trim() || null,
      input.phone?.trim() || null,
      input.is_active ?? true,
    ],
  );
  return result.rows[0];
}

function matchesFilters(row: DbProductionEntry, filters: ProductionListFilters): boolean {
  const d = dateOnly(row.production_date);
  if (filters.fromDate && d < filters.fromDate) return false;
  if (filters.toDate && d > filters.toDate) return false;
  if (filters.insurerId && row.insurer_id !== filters.insurerId) return false;
  if (filters.doneByUserId && row.done_by_user_id !== filters.doneByUserId) return false;
  if (filters.seenByUserId && row.seen_by_user_id !== filters.seenByUserId) return false;
  if (filters.instructedByUserId && row.instructed_by_user_id !== filters.instructedByUserId) {
    return false;
  }
  if (filters.status && row.status !== filters.status) return false;
  if (filters.createdByUserId && row.created_by !== filters.createdByUserId) return false;
  if (filters.registrationNumber) {
    const q = filters.registrationNumber.toLowerCase();
    if (!row.registration_number.toLowerCase().includes(q)) return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const hay = [
      row.registration_number,
      row.assignment || '',
      row.remarks || '',
      String(row.amount),
      row.insurer_name || '',
      row.done_by_name || '',
      row.seen_by_name || '',
      row.instructed_by_name || '',
    ]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export async function listProductionEntries(
  filters: ProductionListFilters = {},
): Promise<DbProductionEntry[]> {
  await ensureDb();
  const users = await userNameMap();

  if (isJsonMode()) {
    const insurers = new Map(getStore().insurers.map((i) => [i.id, i.name]));
    return getStore()
      .entries.map((e) => enrichEntry(e, insurers, users))
      .filter((e) => matchesFilters(e, filters))
      .sort((a, b) =>
        b.production_date.localeCompare(a.production_date) || b.id - a.id,
      );
  }

  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('production_entries')
      .select('*, insurers(name)')
      .order('production_date', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw new Error(error.message);
    const insurers = new Map<number, string>();
    const rows = (data || []).map((raw) => {
      const r = raw as DbProductionEntry & { insurers?: { name?: string } | null };
      if (r.insurers?.name) insurers.set(r.insurer_id, r.insurers.name);
      return enrichEntry(
        {
          ...r,
          insurer_name: r.insurers?.name || null,
        },
        insurers,
        users,
      );
    });
    return rows.filter((e) => matchesFilters(e, filters));
  }

  const result = await query<DbProductionEntry>(
    `SELECT e.*, i.name AS insurer_name
     FROM production_entries e
     LEFT JOIN insurers i ON i.id = e.insurer_id
     ORDER BY e.production_date DESC, e.id DESC`,
  );
  const insurers = new Map<number, string>();
  result.rows.forEach((r) => {
    if (r.insurer_name) insurers.set(r.insurer_id, r.insurer_name);
  });
  return result.rows
    .map((r) => enrichEntry(r, insurers, users))
    .filter((e) => matchesFilters(e, filters));
}

export async function getProductionEntry(id: number): Promise<DbProductionEntry | null> {
  const rows = await listProductionEntries({});
  return rows.find((r) => r.id === id) || null;
}

export type ProductionEntryInput = {
  production_date: string;
  insurer_id: number;
  registration_number: string;
  assignment?: string | null;
  amount: number;
  done_by_user_id?: number | null;
  seen_by_user_id?: number | null;
  instructed_by_user_id?: number | null;
  remarks?: string | null;
  status?: ProductionStatus;
};

export async function createProductionEntry(
  input: ProductionEntryInput,
  userId: number,
): Promise<DbProductionEntry> {
  await ensureDb();
  const vat = await getVatRate();
  const amount = num(input.amount);
  const without = amountWithoutVat(amount, vat);
  const now = new Date().toISOString();
  const status = input.status || 'completed';
  const reg = input.registration_number.trim().toUpperCase();
  const assignment = normalizeAssignment(input.assignment);

  if (isJsonMode()) {
    const s = getStore();
    const id = s.entryCounter + 1;
    s.entryCounter = id;
    const row: DbProductionEntry = {
      id,
      production_date: dateOnly(input.production_date),
      insurer_id: input.insurer_id,
      registration_number: reg,
      assignment,
      amount,
      amount_without_vat: without,
      done_by_user_id: input.done_by_user_id ?? null,
      seen_by_user_id: input.seen_by_user_id ?? null,
      instructed_by_user_id: input.instructed_by_user_id ?? null,
      remarks: input.remarks?.trim() || null,
      status,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    };
    s.entries.push(row);
    saveStore();
    const found = await getProductionEntry(id);
    return found!;
  }

  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('production_entries')
      .insert({
        production_date: dateOnly(input.production_date),
        insurer_id: input.insurer_id,
        registration_number: reg,
        assignment,
        amount,
        amount_without_vat: without,
        done_by_user_id: input.done_by_user_id ?? null,
        seen_by_user_id: input.seen_by_user_id ?? null,
        instructed_by_user_id: input.instructed_by_user_id ?? null,
        remarks: input.remarks?.trim() || null,
        status,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return (await getProductionEntry((data as DbProductionEntry).id))!;
  }

  const result = await query<DbProductionEntry>(
    `INSERT INTO production_entries (
      production_date, insurer_id, registration_number, assignment, amount, amount_without_vat,
      done_by_user_id, seen_by_user_id, instructed_by_user_id, remarks, status,
      created_by, updated_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      dateOnly(input.production_date),
      input.insurer_id,
      reg,
      assignment,
      amount,
      without,
      input.done_by_user_id ?? null,
      input.seen_by_user_id ?? null,
      input.instructed_by_user_id ?? null,
      input.remarks?.trim() || null,
      status,
      userId,
      userId,
    ],
  );
  return (await getProductionEntry(result.rows[0].id))!;
}

export async function updateProductionEntry(
  id: number,
  input: ProductionEntryInput,
  userId: number,
): Promise<DbProductionEntry | null> {
  await ensureDb();
  const vat = await getVatRate();
  const amount = num(input.amount);
  const without = amountWithoutVat(amount, vat);
  const status = input.status || 'completed';
  const reg = input.registration_number.trim().toUpperCase();
  const assignment = normalizeAssignment(input.assignment);
  const now = new Date().toISOString();

  if (isJsonMode()) {
    const s = getStore();
    const idx = s.entries.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    s.entries[idx] = {
      ...s.entries[idx],
      production_date: dateOnly(input.production_date),
      insurer_id: input.insurer_id,
      registration_number: reg,
      assignment,
      amount,
      amount_without_vat: without,
      done_by_user_id: input.done_by_user_id ?? null,
      seen_by_user_id: input.seen_by_user_id ?? null,
      instructed_by_user_id: input.instructed_by_user_id ?? null,
      remarks: input.remarks?.trim() || null,
      status,
      updated_by: userId,
      updated_at: now,
    };
    saveStore();
    return getProductionEntry(id);
  }

  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client
      .from('production_entries')
      .update({
        production_date: dateOnly(input.production_date),
        insurer_id: input.insurer_id,
        registration_number: reg,
        assignment,
        amount,
        amount_without_vat: without,
        done_by_user_id: input.done_by_user_id ?? null,
        seen_by_user_id: input.seen_by_user_id ?? null,
        instructed_by_user_id: input.instructed_by_user_id ?? null,
        remarks: input.remarks?.trim() || null,
        status,
        updated_by: userId,
        updated_at: now,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return getProductionEntry(id);
  }

  const result = await query<DbProductionEntry>(
    `UPDATE production_entries SET
      production_date=$1, insurer_id=$2, registration_number=$3, assignment=$4, amount=$5, amount_without_vat=$6,
      done_by_user_id=$7, seen_by_user_id=$8, instructed_by_user_id=$9, remarks=$10, status=$11,
      updated_by=$12, updated_at=NOW()
     WHERE id=$13 RETURNING *`,
    [
      dateOnly(input.production_date),
      input.insurer_id,
      reg,
      assignment,
      amount,
      without,
      input.done_by_user_id ?? null,
      input.seen_by_user_id ?? null,
      input.instructed_by_user_id ?? null,
      input.remarks?.trim() || null,
      status,
      userId,
      id,
    ],
  );
  if (!result.rows[0]) return null;
  return getProductionEntry(id);
}

export async function deleteProductionEntry(id: number): Promise<boolean> {
  await ensureDb();
  if (isJsonMode()) {
    const s = getStore();
    const before = s.entries.length;
    s.entries = s.entries.filter((e) => e.id !== id);
    saveStore();
    return s.entries.length < before;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { error, count } = await client
      .from('production_entries')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return (count || 0) > 0;
  }
  const result = await query(`DELETE FROM production_entries WHERE id = $1`, [id]);
  return (result.rowCount || 0) > 0;
}

export async function listTargets(): Promise<DbProductionTarget[]> {
  await ensureDb();
  if (isJsonMode()) return [...getStore().targets].sort((a, b) => b.period_key.localeCompare(a.period_key));
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client.from('production_targets').select('*').order('period_key', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as DbProductionTarget[];
  }
  const result = await query<DbProductionTarget>(
    `SELECT * FROM production_targets ORDER BY period_key DESC`,
  );
  return result.rows.map((t) => ({
    ...t,
    target_jobs: num(t.target_jobs),
    target_amount: num(t.target_amount),
  }));
}

export async function upsertTarget(input: {
  period_type: 'daily' | 'weekly' | 'monthly';
  period_key: string;
  target_jobs: number;
  target_amount: number;
}): Promise<DbProductionTarget> {
  await ensureDb();
  if (isJsonMode()) {
    const s = getStore();
    const idx = s.targets.findIndex(
      (t) => t.period_type === input.period_type && t.period_key === input.period_key,
    );
    if (idx >= 0) {
      s.targets[idx] = {
        ...s.targets[idx],
        target_jobs: input.target_jobs,
        target_amount: input.target_amount,
      };
      saveStore();
      return s.targets[idx];
    }
    const id = s.targetCounter + 1;
    s.targetCounter = id;
    const row: DbProductionTarget = {
      id,
      period_type: input.period_type,
      period_key: input.period_key,
      target_jobs: input.target_jobs,
      target_amount: input.target_amount,
      created_at: new Date().toISOString(),
    };
    s.targets.push(row);
    saveStore();
    return row;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('production_targets')
      .upsert(
        {
          period_type: input.period_type,
          period_key: input.period_key,
          target_jobs: input.target_jobs,
          target_amount: input.target_amount,
        },
        { onConflict: 'period_type,period_key' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DbProductionTarget;
  }
  const result = await query<DbProductionTarget>(
    `INSERT INTO production_targets (period_type, period_key, target_jobs, target_amount)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (period_type, period_key)
     DO UPDATE SET target_jobs = EXCLUDED.target_jobs, target_amount = EXCLUDED.target_amount
     RETURNING *`,
    [input.period_type, input.period_key, input.target_jobs, input.target_amount],
  );
  return result.rows[0];
}

export async function createNotification(input: {
  userId?: number | null;
  type: string;
  title: string;
  body?: string;
}): Promise<DbAppNotification> {
  await ensureDb();
  const now = new Date().toISOString();
  if (isJsonMode()) {
    const s = getStore();
    const id = s.notificationCounter + 1;
    s.notificationCounter = id;
    const row: DbAppNotification = {
      id,
      user_id: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      read_at: null,
      created_at: now,
    };
    s.notifications.unshift(row);
    saveStore();
    return row;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('app_notifications')
      .insert({
        user_id: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DbAppNotification;
  }
  const result = await query<DbAppNotification>(
    `INSERT INTO app_notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.userId ?? null, input.type, input.title, input.body || null],
  );
  return result.rows[0];
}

export async function listNotifications(
  userId: number,
  limit = 30,
): Promise<DbAppNotification[]> {
  await ensureDb();
  if (isJsonMode()) {
    return getStore()
      .notifications.filter((n) => n.user_id === null || n.user_id === userId)
      .slice(0, limit);
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('app_notifications')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []) as DbAppNotification[];
  }
  const result = await query<DbAppNotification>(
    `SELECT * FROM app_notifications
     WHERE user_id IS NULL OR user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  await ensureDb();
  if (isJsonMode()) {
    const s = getStore();
    const n = s.notifications.find((x) => x.id === id);
    if (n && (n.user_id === null || n.user_id === userId)) {
      n.read_at = new Date().toISOString();
      saveStore();
    }
    return;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    await client
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    return;
  }
  await query(
    `UPDATE app_notifications SET read_at = NOW()
     WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [id, userId],
  );
}

export async function createPasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await ensureDb();
  if (isJsonMode()) {
    const s = getStore();
    const id = s.resetCounter + 1;
    s.resetCounter = id;
    s.resetTokens.push({
      id,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      used_at: null,
      created_at: new Date().toISOString(),
    });
    saveStore();
    return;
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client.from('password_reset_tokens').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);
    return;
  }
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  );
}

export async function consumePasswordResetToken(
  tokenHash: string,
): Promise<{ userId: number } | null> {
  await ensureDb();
  const now = new Date();
  if (isJsonMode()) {
    const s = getStore();
    const token = s.resetTokens.find(
      (t) => t.token_hash === tokenHash && !t.used_at && new Date(t.expires_at) > now,
    );
    if (!token) return null;
    token.used_at = now.toISOString();
    saveStore();
    return { userId: token.user_id };
  }
  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('password_reset_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    await client
      .from('password_reset_tokens')
      .update({ used_at: now.toISOString() })
      .eq('id', data.id);
    return { userId: data.user_id };
  }
  const result = await query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
  return { userId: row.user_id };
}
