// Two-way state hook backed by URL query params with default pruning & push/replace control.
// Simplifies list filter + pagination synchronization patterns.
"use client";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { parseQuery, buildQuery, QueryShape } from '@/lib/qs';

export function useQueryParamsState<T extends QueryShape>(defaults: T) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const state = useMemo(() => parseQuery(search?.toString() ?? '', defaults), [search, defaults]);

  const setState = useCallback((patch: Partial<T>, options?: { replace?: boolean }) => {
    const url = buildQuery<T>(pathname, patch, state, defaults, { skipDefaults: true });
    if (options?.replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [pathname, router, state, defaults]);

  return [state as T, setState] as const;
}
