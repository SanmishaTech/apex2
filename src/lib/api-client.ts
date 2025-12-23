// Lightweight Axios wrapper: unified request helper with optional toast error surfacing
// Exposes convenience verbs (apiGet/Post/etc) & SWR fetcher utilities.
import axios, { AxiosError } from "axios";
import { toast } from "@/lib/toast";

// Relaxed typing: minimal interfaces, direct return values.
export type ApiClientOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  authToken?: string;
  showErrorToast?: boolean;
  timeoutMs?: number;
};

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || undefined,
  withCredentials: true,
  timeout: 15000,
});

// Simple request wrapper
async function request<T = unknown>(method: string, url: string, data?: unknown, opts: ApiClientOptions = {}): Promise<T> {
  try {
    const res = await instance.request<T>({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url,
      data,
      timeout: opts.timeoutMs ?? 15000,
      headers: {
        ...(opts.headers || {}),
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
      },
      baseURL: opts.baseUrl || instance.defaults.baseURL,
    });
    return res.data as T;
  } catch (e) {
    const ax = e as AxiosError;
    const respData: unknown = ax.response?.data;
    let msg: string | undefined;
    if (respData && typeof respData === 'object' && 'message' in respData) {
      const m = (respData as Record<string, unknown>).message;
      if (typeof m === 'string') msg = m;
    }
    const message = msg || ax.message || "Request failed";
    if (opts.showErrorToast) toast.error(message);
    const err = new Error(message) as Error & { data?: unknown; status?: number; raw?: unknown };
    err.data = respData;
    err.status = ax.response?.status;
    err.raw = ax;
    throw err;
  }
}

export const apiGet = <T = unknown>(path: string, opts?: ApiClientOptions) => request<T>('GET', path, undefined, opts);
export const apiPost = <T = unknown, B = unknown>(path: string, body: B, opts?: ApiClientOptions) => request<T>('POST', path, body, opts);
export const apiPut =  <T = unknown, B = unknown>(path: string, body: B, opts?: ApiClientOptions) => request<T>('PUT', path, body, opts);
export const apiPatch =<T = unknown, B = unknown>(path: string, body: B, opts?: ApiClientOptions) => request<T>('PATCH', path, body, opts);
export const apiDelete = <T = unknown, B = unknown>(path: string, body?: B, opts?: ApiClientOptions) => request<T>('DELETE', path, body, opts);

// Multipart/FormData upload helper.
// Usage: apiUpload('/api/resource', formData) // POST by default
//        apiUpload('/api/resource/123', formData, { method: 'PATCH' })
export const apiUpload = <T = unknown>(path: string, form: FormData, opts?: (ApiClientOptions & { method?: 'POST' | 'PUT' | 'PATCH' })) => {
  const method = opts?.method || 'POST';
  return request<T>(method, path, form, opts);
};

// SWR helpers (return plain data)
export const swrFetcher = <T = unknown>(path: string) => apiGet<T>(path);
export const swrMutationFetcher = <T = unknown, B = unknown>(url: string, { arg }: { arg: B }) => apiPost<T, B>(url, arg);
