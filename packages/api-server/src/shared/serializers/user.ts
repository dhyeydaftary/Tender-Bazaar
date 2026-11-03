/**
 * Response serialisation for user records.
 *
 * Prisma `include` queries return every column of the User row, and the admin
 * user-detail endpoint returned that row as-is: `passwordHash` (bcrypt) and
 * `googleId` (the identifier that signs a Google account in as this user)
 * went to any administrator's browser. Most endpoints already use an explicit
 * `select`; this module is the belt for the ones that cannot, and for nested
 * user objects inside other records.
 */

/** Columns of the User row that are authentication material, never response data. */
export const SENSITIVE_USER_FIELDS = ['passwordHash', 'googleId'] as const;

type SensitiveUserField = (typeof SENSITIVE_USER_FIELDS)[number];

const SENSITIVE = new Set<string>(SENSITIVE_USER_FIELDS);

/**
 * Deep-copy `value`, dropping every sensitive user field at any depth. Dates,
 * Buffers and other non-plain objects are passed through untouched, arrays
 * are mapped, plain objects are rebuilt without the sensitive keys.
 */
export function stripSensitiveUserFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveUserFields(item)) as unknown as T;
  }
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE.has(key)) continue;
    out[key] = stripSensitiveUserFields(inner);
  }
  return out as T;
}

/** A user record as it may leave the API: everything except the secrets. */
export type SafeUser<T> = Omit<T, SensitiveUserField>;

export function toSafeUser<T extends object>(user: T): SafeUser<T> {
  return stripSensitiveUserFields(user) as SafeUser<T>;
}

/**
 * True when `payload`, at any depth, still carries a sensitive user field.
 * Used by the tests to inspect real response bodies.
 */
export function containsSensitiveUserFields(payload: unknown): boolean {
  if (Array.isArray(payload)) return payload.some(containsSensitiveUserFields);
  if (payload === null || typeof payload !== 'object') return false;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE.has(key)) return true;
    if (containsSensitiveUserFields(value)) return true;
  }
  return false;
}
