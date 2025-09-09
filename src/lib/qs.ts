// Query-string helpers: typed parse & build preserving defaults and omitting empty/default params.
import qs from 'query-string';

// Wrapper around query-string with typed helpers.

export type StringifyOptions = { skipDefaults?: boolean };

type Primitive = string | number | boolean | null | undefined;
export type QueryShape = Record<string, Primitive | Primitive[]>;

export function parseQuery<T extends QueryShape>(search: string, defaults: T): T {
  const parsed = qs.parse(search, { arrayFormat: 'bracket' });
  const result: Record<string, Primitive | Primitive[]> = { ...defaults };
  Object.entries(parsed).forEach(([k, v]) => {
    if (!(k in defaults)) return;
    const def = defaults[k as keyof T];
    if (Array.isArray(def)) {
      result[k] = Array.isArray(v) ? v.map(String) : v != null ? [String(v)] : [];
      return;
    }
    if (typeof def === 'number' && typeof v === 'string') result[k] = Number(v) || def;
    else if (typeof def === 'boolean' && typeof v === 'string') result[k] = v === 'true';
    else if (v != null) result[k] = Array.isArray(v) ? v[0] as string : (v as string);
  });
  return result as T;
}

export function buildQuery<T extends QueryShape>(pathname: string, patch: Partial<T>, current: T, defaults: T, opts?: StringifyOptions) {
  const base: QueryShape = { ...current, ...patch };
  Object.entries(base).forEach(([k, v]) => {
    const def = defaults[k as keyof T];
    const isEmptyArray = Array.isArray(v) && v.length === 0;
    if (v === undefined || v === null || v === '' || isEmptyArray || (opts?.skipDefaults && v === def)) {
      delete base[k];
    }
  });
  const query = qs.stringify(base, { arrayFormat: 'bracket', skipNull: true, skipEmptyString: true, sort: false });
  return query ? `${pathname}?${query}` : pathname;
}
