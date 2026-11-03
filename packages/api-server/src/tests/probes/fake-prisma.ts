/**
 * An in-memory stand-in for the Prisma client, injected through the require
 * cache so the REAL Express app, middleware and services run against it.
 *
 * Only the User model is modelled with any fidelity (it is what the admin
 * user-management probes exercise); every other model answers with empty
 * results. `select`/`include` are honoured on User reads: `select` returns
 * exactly the requested scalar fields, `include` returns the whole row (as
 * Prisma does), which is how the password hash used to escape.
 */

export type Row = Record<string, any>;

export interface FakeDb {
  prisma: any;
  users: Row[];
  writes: string[];
  auditLogs: Row[];
}

function pick(row: Row, select: Record<string, unknown> | undefined): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [key, wanted] of Object.entries(select)) {
    if (!wanted) continue;
    if (key === 'subscription' || key === 'companyProfile') out[key] = null;
    else if (key === '_count') out[key] = {};
    else out[key] = row[key];
  }
  return out;
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

export function makeFakePrisma(users: Row[]): FakeDb {
  const db: FakeDb = { prisma: null, users: users.map((u) => ({ ...u })), writes: [], auditLogs: [] };

  const emptyArrays = ['payments', 'savedTenders', 'alerts', 'eligibilityChecks', 'searchHistory', 'notifications', 'sessions'];

  const user = {
    findUnique: async ({ where, select, include }: Row) => {
      const row = db.users.find((u) => matches(u, where));
      if (!row) return null;
      if (include) {
        const full: Row = { ...row, subscription: null, companyProfile: null, _count: {} };
        for (const name of emptyArrays) if (include[name]) full[name] = [];
        return full;
      }
      return pick(row, select);
    },
    findFirst: async ({ where, select }: Row) => {
      const row = db.users.find((u) => matches(u, where));
      return row ? pick(row, select) : null;
    },
    findMany: async ({ where, select }: Row = {}) => db.users.filter((u) => matches(u, where)).map((u) => pick(u, select)),
    count: async ({ where }: Row = {}) => db.users.filter((u) => matches(u, where)).length,
    update: async ({ where, data, select }: Row) => {
      const row = db.users.find((u) => matches(u, where));
      if (!row) throw new Error('fake prisma: user not found');
      Object.assign(row, data);
      db.writes.push(`user.update:${row.id}:${Object.keys(data).join(',')}`);
      return pick(row, select);
    },
    create: async ({ data, select }: Row) => {
      const row = { id: `user-${db.users.length + 1}`, role: 'USER', ...data };
      db.users.push(row);
      db.writes.push(`user.create:${row.id}`);
      return pick(row, select);
    },
  };

  const noop = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async ({ data }: Row = {}) => ({ id: 'row', ...data }),
    update: async ({ data }: Row = {}) => ({ ...data }),
    updateMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
    delete: async () => ({}),
    upsert: async () => ({}),
    aggregate: async () => ({}),
    groupBy: async () => [],
  };

  const auditLog = {
    ...noop,
    create: async ({ data }: Row) => {
      db.auditLogs.push(data);
      return { id: `audit-${db.auditLogs.length}`, ...data };
    },
  };

  const session = {
    ...noop,
    deleteMany: async ({ where }: Row = {}) => {
      db.writes.push(`session.deleteMany:${where?.userId ?? '*'}`);
      return { count: 0 };
    },
  };

  const models: Row = { user, auditLog, session };

  db.prisma = new Proxy(
    {
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      $queryRaw: async () => [],
      $queryRawUnsafe: async () => [],
      $executeRaw: async () => 0,
      $executeRawUnsafe: async () => 0,
      $transaction: async (arg: any) => (typeof arg === 'function' ? arg(db.prisma) : Promise.all(arg)),
    },
    {
      get(target, prop: string) {
        if (prop in target) return (target as Row)[prop];
        if (typeof prop !== 'string') return undefined;
        return models[prop] ?? noop;
      },
    },
  );

  return db;
}

/**
 * Replace a module in the require cache before anything imports it. Marked as
 * an ES module so `import x from` resolves to `exports.default` rather than
 * to the whole exports object (tsx/esbuild's interop).
 */
export function injectModule(modulePath: string, exports: Record<string, unknown>): void {
  const id = require.resolve(modulePath);
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { __esModule: true, ...exports },
  } as any;
}

/** A Redis stand-in with the handful of commands the auth paths use. */
export function makeFakeRedis() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  let now = Date.now();
  const alive = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      store.delete(key);
      return null;
    }
    return entry;
  };
  const redis = {
    get: async (key: string) => alive(key)?.value ?? null,
    set: async (key: string, value: string) => {
      store.set(key, { value, expiresAt: null });
      return 'OK';
    },
    setex: async (key: string, ttl: number, value: string) => {
      store.set(key, { value, expiresAt: now + ttl * 1000 });
      return 'OK';
    },
    del: async (...keys: string[]) => keys.reduce((n, key) => n + (store.delete(key) ? 1 : 0), 0),
    incr: async (key: string) => {
      const entry = alive(key);
      const value = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: String(value), expiresAt: entry?.expiresAt ?? null });
      return value;
    },
    expire: async (key: string, ttl: number) => {
      const entry = alive(key);
      if (!entry) return 0;
      entry.expiresAt = now + ttl * 1000;
      return 1;
    },
    ttl: async (key: string) => {
      const entry = alive(key);
      if (!entry) return -2;
      return entry.expiresAt === null ? -1 : Math.ceil((entry.expiresAt - now) / 1000);
    },
    hincrby: async () => 1,
    ping: async () => 'PONG',
    on: () => redis,
    /** Test control: move the fake clock forward. */
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
    /** Test control: raw read of a key regardless of expiry. */
    peek: (key: string) => store.get(key)?.value ?? null,
    keys: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix) && alive(k));
    },
  };
  return redis;
}
