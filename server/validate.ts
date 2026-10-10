export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

type Opt = { required?: boolean; max?: number };

export function str(v: unknown, field: string, opt: Opt = {}): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (opt.required) throw bad(`${field} is required`);
    return v === '' ? '' : undefined;
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const s = v.trim();
  if (opt.required && !s) throw bad(`${field} is required`);
  if (s.length > (opt.max ?? 5000)) throw bad(`${field} is too long`);
  return s;
}

export function int(v: unknown, field: string, opt: { required?: boolean; min?: number; max?: number } = {}) {
  if (v === undefined || v === null || v === '') {
    if (opt.required) throw bad(`${field} is required`);
    return v === undefined ? undefined : null;
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw bad(`${field} must be a whole number`);
  if (opt.min !== undefined && n < opt.min) throw bad(`${field} must be at least ${opt.min}`);
  if (opt.max !== undefined && n > opt.max) throw bad(`${field} must be at most ${opt.max}`);
  return n;
}

export function oneOf<T extends string>(v: unknown, field: string, values: readonly T[], opt: { required?: boolean } = {}) {
  if (v === undefined || v === null || v === '') {
    if (opt.required) throw bad(`${field} is required`);
    return undefined;
  }
  if (!values.includes(v as T)) throw bad(`${field} must be one of: ${values.join(', ')}`);
  return v as T;
}

export function strList(v: unknown, field: string): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw bad(`${field} must be a list of text`);
  return v.map((s: string) => s.trim()).filter(Boolean);
}

export function isoDate(v: unknown, field: string, opt: { required?: boolean } = {}) {
  if (v === undefined || v === null || v === '') {
    if (opt.required) throw bad(`${field} is required`);
    return v === undefined ? undefined : null;
  }
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw bad(`${field} must be a valid date`);
  return v;
}

/** Drop undefined keys so partial updates only touch provided fields. */
export function defined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
