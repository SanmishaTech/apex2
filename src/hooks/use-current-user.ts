// SWR hook for current authenticated user (session state). Returns { user, error, isLoading, mutate }.
// Source of truth for role/permissions resolution client-side.
"use client";

import useSWR from "swr";
import { CurrentUser } from "@/types";
import { apiGet } from "@/lib/api-client";

const fetcher = () => apiGet<CurrentUser>("/api/users/me");

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>(
    "/api/users/me",
    fetcher,
    {
      shouldRetryOnError: false,
      // Revalidate aggressively to avoid stale role/permissions after auth changes
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      refreshInterval: 0,
      dedupingInterval: 0,
      focusThrottleInterval: 0
    }
  );
  return {
    user: data ?? null,
    error,
    isLoading,
    mutate
  };
}
