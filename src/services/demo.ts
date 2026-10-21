// ─────────────────────────────────────────────
//  IASIS — Modo demonstração
//  "Entrar como demonstração" troca o Supabase por um banco em memória com
//  dados fictícios (demoData.ts). As telas e serviços continuam os mesmos:
//  só muda quem responde às consultas. Serve para apresentar o app sem
//  conta nem código de ativação, e nada é gravado no banco de verdade.
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildDemoTables, DEMO_PATIENT_ID, DEMO_CAREGIVER_ID,
  type DemoRole, type Row, type Tables,
} from './demoData';

const KEY = 'iasis:demo-role';

let role: DemoRole | null = null;
let tables: Tables = {};
let restored: Promise<void> | null = null;

export const isDemoActive = () => role !== null;
export const demoUserId = () => (role === 'caregiver' ? DEMO_CAREGIVER_ID : DEMO_PATIENT_ID);

// Os dados ficam na memória até o app fechar: dá para tomar a dose como
// paciente, sair e entrar como cuidador para ver a mesma dose como tomada.
export const startDemo = async (r: DemoRole) => {
  role = r;
  if (!Object.keys(tables).length) tables = buildDemoTables();
  await AsyncStorage.setItem(KEY, r).catch(() => {});
};

export const stopDemo = async () => {
  role = null;
  await AsyncStorage.removeItem(KEY).catch(() => {});
};

// Reabre a demo depois de recarregar a página/app. Roda uma vez só.
export const restoreDemo = () => {
  if (!restored) {
    restored = AsyncStorage.getItem(KEY)
      .then((r) => { if (r === 'patient' || r === 'caregiver') { role = r; tables = buildDemoTables(); } })
      .catch(() => {});
  }
  return restored;
};

// ── Mini PostgREST em memória ────────────────
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Filter = (r: Row) => boolean;

let seq = 0;
const newId = () => `demo-${Date.now().toString(36)}-${++seq}`;

const parseValue = (v: string): any =>
  v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;

// Só o formato usado pelo chat: and(a.eq.x,b.eq.y),and(...)
const parseOr = (expr: string): Filter => {
  const groups = expr.match(/and\(([^)]*)\)/g) ?? [];
  const tests = groups.map((g) => {
    const conds = g.slice(4, -1).split(',').map((c) => {
      const [col, , ...rest] = c.split('.');
      const val = parseValue(rest.join('.'));
      return (r: Row) => r[col] === val;
    });
    return (r: Row) => conds.every((t) => t(r));
  });
  return (r) => tests.some((t) => t(r));
};

const withEmbeds = (row: Row, cols: string) => {
  const out: Row = { ...row };
  if (cols.includes('medications(')) {
    out.medications = (tables.medications ?? []).find((m) => m.id === row.medication_id) ?? null;
  }
  if (cols.trim() === '*' || cols.includes('*,') || cols.startsWith('*')) return out;
  const picked: Row = {};
  cols.split(',').map((c) => c.trim()).filter((c) => c && !c.includes('(')).forEach((c) => { picked[c] = row[c]; });
  if (out.medications !== undefined) picked.medications = out.medications;
  return picked;
};

class DemoQuery implements PromiseLike<any> {
  private op: Op = 'select';
  private cols = '*';
  private returning = false;
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private one: 'single' | 'maybe' | null = null;
  private countExact = false;
  private head = false;
  private payload: any = null;
  private conflict = 'id';

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.cols = cols;
      this.countExact = opts?.count === 'exact';
      this.head = !!opts?.head;
    } else {
      this.returning = true;
      this.cols = cols;
    }
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this; }
  update(patch: Row)        { this.op = 'update'; this.payload = patch; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert'; this.payload = rows; this.conflict = opts?.onConflict ?? 'id'; return this;
  }
  delete() { this.op = 'delete'; return this; }

  eq(c: string, v: any)  { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  gt(c: string, v: any)  { this.filters.push((r) => r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  lt(c: string, v: any)  { this.filters.push((r) => r[c] < v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this; }
  is(c: string, v: any)  { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  or(expr: string)       { this.filters.push(parseOr(expr)); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  single()      { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }

  then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }

  private run() {
    const all = (tables[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let rows: Row[];

    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      rows = list.map((p) => {
        const existing = this.op === 'upsert' ? all.find((r) => r[this.conflict] === p[this.conflict]) : undefined;
        if (existing) return Object.assign(existing, p);
        const row = { id: newId(), created_at: new Date().toISOString(), ...p };
        all.push(row);
        return row;
      });
    } else if (this.op === 'update') {
      rows = all.filter(match);
      rows.forEach((r) => Object.assign(r, this.payload));
      if (this.table === 'doses') rows.forEach(notifyCaregiver);
    } else if (this.op === 'delete') {
      rows = all.filter(match);
      tables[this.table] = all.filter((r) => !match(r));
    } else {
      rows = all.filter(match);
    }

    if (this.op === 'select') {
      for (const { col, asc } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => (a[col] === b[col] ? 0 : (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1)));
      }
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      if (this.head) return { data: null, error: null, count: rows.length };
    } else if (!this.returning) {
      return { data: null, error: null };
    }

    const data = rows.map((r) => withEmbeds(r, this.cols));
    if (this.one) {
      if (data.length === 1) return { data: data[0], error: null };
      if (data.length === 0 && this.one === 'maybe') return { data: null, error: null };
      return { data: null, error: { message: 'Registro não encontrado (demonstração).' } };
    }
    return { data, error: null, count: this.countExact ? data.length : null };
  }
}

// ── Funções do banco (RPC) com comportamento de demonstração ──
const profile = (id: string) => (tables.profiles ?? []).find((p) => p.id === id);

// Faz o papel do gatilho do banco: dose tomada vira alerta para o cuidador.
function notifyCaregiver(dose: Row) {
  if (dose.status !== 'taken' && dose.status !== 'late') return;
  const patient = profile(dose.user_id);
  const med = (tables.medications ?? []).find((m) => m.id === dose.medication_id);
  if (!patient?.caregiver_id || !med) return;
  const when = new Date(dose.taken_at ?? Date.now());
  const hhmm = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  const how = dose.validated_by === 'rfid' ? ', validada pela pulseira' : '';
  (tables.alerts ??= []).unshift({
    id: newId(), user_id: patient.caregiver_id, patient_id: patient.id, dose_id: dose.id,
    medication_id: med.id, type: 'dose_taken', title: 'Dose tomada',
    body: `${patient.name} tomou ${med.name} ${med.dosage} às ${hhmm}${how}.`,
    read: false, created_at: when.toISOString(),
  });
}

const rpc = async (fn: string, args: Row = {}) => {
  const me = demoUserId();
  switch (fn) {
    case 'sync_overdue_doses': {
      const limit = new Date(Date.now() - 60 * 60000).toISOString();
      const late = (tables.doses ?? []).filter((d) => d.status === 'pending' && d.scheduled_at < limit);
      late.forEach((d) => { d.status = 'missed'; });
      return { data: late.length, error: null };
    }
    case 'caregiver_mark_dose_taken': {
      const d = (tables.doses ?? []).find((x) => x.id === args.p_dose);
      if (d) Object.assign(d, { status: 'taken', taken_at: new Date().toISOString(), validated_by: 'caregiver' });
      return { data: true, error: null };
    }
    case 'restock_medication': {
      const m = (tables.medications ?? []).find((x) => x.id === args.p_medication);
      if (m) m.stock = (m.stock ?? 0) + Number(args.p_amount ?? 0);
      return { data: m?.stock ?? null, error: null };
    }
    case 'list_chat_contacts': {
      const other = profile(me === DEMO_PATIENT_ID ? DEMO_CAREGIVER_ID : DEMO_PATIENT_ID);
      return { data: other ? [other] : [], error: null };
    }
    case 'list_care_team': {
      const patientSide = me === DEMO_PATIENT_ID;
      const other = profile(patientSide ? DEMO_CAREGIVER_ID : DEMO_PATIENT_ID)!;
      return {
        data: [{
          link_id: 'demo-link-1', person_id: other.id, name: other.name, phone: other.phone,
          role: other.role, avatar_url: other.avatar_url, relation: 'Filho',
          side: patientSide ? 'caregiver' : 'patient', created_at: other.created_at,
        }],
        error: null,
      };
    }
    case 'raise_emergency':
      return { data: 1, error: null };
    case 'check_access_code':
      return { data: [{ valid: false, reason: 'not_found' }], error: null };
    default:
      return { data: null, error: null };
  }
};

// ── Tempo real: na demo não há servidor, o canal só existe ──
const fakeChannel = () => {
  const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: async () => 'ok' };
  return ch;
};

const demoSession = () => {
  const p = profile(demoUserId());
  return {
    access_token: 'demo', refresh_token: 'demo', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: demoUserId(), email: p?.email, user_metadata: { name: p?.name, role: p?.role } },
  };
};

export const demoClient = {
  from: (table: string) => new DemoQuery(table),
  rpc,
  channel: (_name: string) => fakeChannel(),
  removeChannel: async (_ch: unknown) => 'ok',
  auth: {
    getSession: async () => ({ data: { session: demoSession() }, error: null }),
    signOut: async () => { await stopDemo(); return { error: null }; },
    onAuthStateChange: (_cb: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Saia da demonstração para entrar com sua conta.' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Saia da demonstração para criar uma conta.' } }),
    resend: async () => ({ error: null }),
  },
};
