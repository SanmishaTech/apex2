## Purpose

Guidance for AI assistants (code completion / chat) to produce accurate, idiomatic, and safe changes in this repository.

---

## 1. Project Overview

Full‑stack Next.js (App Router) dashboard with JWT auth (access + refresh), RBAC (roles + permissions), Prisma/MySQL, Tailwind + shadcn/ui, SWR for session state, and Axios for API calls. Mobile clients can opt into token-in-body responses (header `x-client-type: mobile`).

## 2. Current Tech Stack

| Concern | Choice | Notes |
| ------- | ------ | ----- |
| Framework | Next.js 15 App Router | Turbopack dev & build |
| Language | TypeScript | Strict mode not fully enabled yet |
| Auth | JWT (`jose`) | Access (short) + refresh (long) tokens |
| DB / ORM | MySQL + Prisma | See `prisma/schema.prisma` |
| UI | shadcn/ui (Radix) + Tailwind | Custom wrappers in `components/common` |
| State (server data) | SWR | `useCurrentUser`, can extend for other resources |
| HTTP Client | Axios | Central in `src/lib/api-client.ts` |
| Validation | Zod | Schemas per route (e.g. login) |
| Theming | next-themes | `ThemeProvider` + toggle component |
| Icons | lucide-react | Consistent sizing (h-4/w-4 etc.) |

## 3. Auth & Session Model

Web flow: login -> set HttpOnly cookies (`accessToken`, `refreshToken`). Access token used for `/api/users/me` fetch via SWR. Logout clears cookies & DB refresh token entry (future revocation enhancements pending). Mobile: tokens returned in JSON body when header `x-client-type: mobile` present.

Refresh tokens persisted in `RefreshToken` table. Rotation + reuse detection NOT yet implemented—design additions should add a dedicated refresh endpoint and rotate on every use.

## 4. Authorization / RBAC

`src/config/roles.ts` defines:
- `PERMISSIONS` constants
- `ROLES`
- `ROLES_PERMISSIONS` mapping

`src/config/access-control.ts` defines page/API prefix rules. A client hook `usePageAccess` enforces page permissions. Server middleware is currently simplified to AUTH‑ONLY (permission enforcement disabled). To re‑enable server permission checks: integrate `findAccessRule` and compare with `ROLES_PERMISSIONS` (see README guidance).

When adding protected resources:
1. Add permission constant if needed.
2. Map permission into appropriate roles.
3. Add nav item (if UI exposure) with its permission.
4. Add rule in `PAGE_ACCESS_RULES` / `API_ACCESS_RULES` for server‑side (if re‑enabled) & client guard.

## 5. Key Hooks & Utilities

| File | Purpose |
| ---- | ------- |
| `useCurrentUser.ts` | SWR fetch of `/api/users/me`; returns `{ user, error, isLoading }` |
| `usePageAccess.ts` | Derives `allowed`, `checking`, required permissions for current pathname |
| `api-client.ts` | Unified Axios wrapper with helpers & toast option |
| `jwt.ts` | Sign/verify access & refresh tokens; duration parsing |
| `api-response.ts` | Standard JSON response helpers (`Success`, `Unauthorized`, etc.) |

## 6. Middleware (`middleware.ts`)

Current behavior: authentication check only. Rejects missing/invalid access token with 401 JSON (API) or redirect to `/login`. Matcher is broad (`'/:path*'`); static/public assets bypass automatically by Next. Permission logic intentionally removed—client guard handles UI; reintroduce server checks for stricter security.

## 7. Coding Conventions

1. Use `@/` path alias (never deep relative chains).
2. Use existing helpers for consistency (e.g., API responses, JWT utils).
3. Prefer composition: small presentational components; keep heavy logic in hooks or lib.
4. Avoid `any`; use generics with defaults or `unknown` then narrow.
5. Maintain consistent icon size (Tailwind `h-4 w-4` inside buttons; `h-5 w-5` for menu triggers where needed).
6. Keep side effects (redirects) inside `useEffect` not during render.
7. Ensure new API routes validate input with Zod and never expose raw Prisma errors.

## 8. Forms Pattern (Login exemplar)
1. Zod schema
2. `react-hook-form` + `zodResolver`
3. Custom inputs (`EmailInput`, `PasswordInput`)
4. Remember-me checkbox (controls refresh expiry expression)
5. Submit via `apiPost` with `{ showErrorToast: true }`
6. Loading state via `AppButton isLoading` prop

## 9. Environment Variables

Required runtime secrets / config (see README for full examples):
```
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES (default 15m)
JWT_REFRESH_EXPIRES (default 30d)
JWT_REFRESH_EXPIRES_SHORT (default 1d)
NEXT_PUBLIC_APP_NAME
```
Optional: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_APP_DESCRIPTION`.
Durations support: number + `m|h|d`.

## 10. Adding an API Route
1. Create `src/app/api/<segment>/route.ts`
2. Validate input (Zod)
3. Access token: read from cookie (web) or Authorization header (mobile scenario - to add if needed)
4. Use response helpers.
5. (Optional future) Add permission rule.

## 11. Adding a Protected Page
1. Create page under `src/app/(dashboard)/...`
2. Add nav item in `config/nav.ts` with `permission`
3. Add permission constant + map to role if new
4. Add prefix rule in `PAGE_ACCESS_RULES`
5. `usePageAccess` + layout redirect covers client UX

## 12. Prisma / Database
Run migrations: `npm run prisma:migrate` (dev). Seed: `npm run seed` (creates admin/user + refresh tokens). Keep schema changes additive; write new migrations not edits to old ones.

## 13. Security Considerations / TODOs
| Area | Current | Planned |
| ---- | ------- | ------- |
| Refresh rotation | Not implemented | Add endpoint + rotation + reuse detection |
| Permission enforcement (server) | Disabled | Reinstate via middleware rules |
| Token revocation | Manual (delete refresh row) | Automatic rotation & blacklist |
| Rate limiting | None | Add middleware / edge limiting |
| Audit logging | None | Add table + events |
| CSRF | Mitigated by sameSite cookies | Consider per-form token if cross-site APIs added |

## 14. What NOT to Do
| Avoid | Instead |
| ----- | ------- |
| Hard-coding role strings | Import from `roles.ts` |
| Duplicating API response shapes | Use helpers in `api-response.ts` |
| Mixing permission logic in many components | Centralize via hooks / config |
| Adding large utility libs casually | Justify & keep bundle lean |

## 15. Quality Checklist for New Changes
Before merging:
- Lint passes (`npm run lint`)
- Types check (implicit via build)
- No unused imports / vars
- Added tests or reasoning (if not, leave concise comment or create TODO issue)
- Updated README / this file if introducing new concepts

## 16. Assistant Guidance
When generating code:
- Use existing patterns (hooks, helpers) first.
- If adding env vars, update documentation & access via a small validation helper if complexity grows.
- Keep patches minimal & focused; do not reformat unrelated code.
- Indicate assumptions explicitly if making one.

## 17. Future Enhancements (Curated)
1. Refresh endpoint & silent access token renewal
2. Server-side permission enforcement toggle via env flag
3. Central environment validator script (`scripts/validate-env.mjs`)
4. `useApi` hook with abort + optimistic updates
5. Zod response validation layer (client & server)
6. Access denied page (403) rather than redirect loop
7. Role / permission management UI + migration to dynamic DB-backed permissions

---

Use this document as the single source of truth for architectural intent and constraints when producing or modifying code.

---

## 18. Common Implementation Recipes

### A. New Resource (Model + CRUD API + List Page)
1. Prisma: Add model to `prisma/schema.prisma` (keep snake_case field names avoided; use camelCase). Run `npm run prisma:migrate` (never edit old migrations).
2. Seed (optional): Add seed data in `prisma/seed.ts` guarded so it stays idempotent (use `upsert`).
3. Permissions: Add `PERMISSIONS.MANAGE_<RESOURCE>` / `READ_<RESOURCE>` etc. in `roles.ts`, map into appropriate roles.
4. API Access Rules: Add rule in `API_ACCESS_RULES` with per-method permission arrays.
5. API Routes: Create `src/app/api/<resource>/route.ts` (and `/:id` if needed). Validate with Zod. Use `guardApiAccess` first line in each handler. Return via `Success(...)` / `Error(...)` helpers only.
6. Pagination: Use `paginate` util (mirror users route pattern) keep `perPage` <= 100.
7. Client List Page: Under `(dashboard)`, replicate `users/page.tsx` structure; use `useQueryParamsState` for filters, `DataTable` for tabular display, `Pagination` for footer.
8. Nav: Add nav item in `nav.ts` with the primary READ permission.
9. Page Access Rule: Add page prefix & permission in `PAGE_ACCESS_RULES`.
10. Guard: Page automatically protected via `useProtectPage` inside layout; no extra code unless special logic.

### B. Adding an Edit / Details Page
1. Create folder path e.g. `(dashboard)/<resource>/<id>/edit/page.tsx`.
2. Fetch record client-side via SWR (`/api/<resource>?id=` or `/api/<resource>/<id>` depending on design).
3. Re-use form components; isolate form state in a component that accepts an existing object to allow reuse for New and Edit.
4. On save, optimistic update (future: implement `useApi` hook with abort + optimistic patterns).

### C. Re‑enabling Server Permission Checks for Pages
1. Import and use `findAccessRule` inside `middleware.ts` after verifying token.
2. If rule type === 'page', compute required permissions using `ROLES_PERMISSIONS[user.role]` (requires decoding token for `sub` + role OR fetching minimal user record). Reject with 403 (JSON for API, redirect to a `/403` page or dashboard for pages) if missing.
3. Keep logic minimal; never duplicate permission constants inline.
4. Add an env flag e.g. `ENABLE_PAGE_PERMISSION_MIDDLEWARE=true` to toggle.

### D. Refresh Token Rotation (Planned Implementation Sketch)
When implemented:
1. Add `/api/auth/refresh` route.
2. Accept refresh token cookie (or body for mobile). Verify + look up in DB.
3. If token found & not revoked & not expired: generate new access + new refresh, mark old refresh row `replacedBy=newToken` & set `revokedAt=now`.
4. If a token reuse attempt (presented token already `revokedAt` set without a legitimate `replacedBy` chain) -> revoke entire token family (walk `replacedBy`).
5. Return (or set cookies) and update DB in a transaction.
6. Clients perform silent refresh before access expiry (SWR revalidation strategy to be added).

### E. Environment Validation Script
Create `scripts/validate-env.mjs` to assert required vars exist & parse durations with `parseDurationMs`. Run early in `next.config.ts` or a dedicated `predev` script. Future PR should update Section 9 to reference it.

### F. DataTable Usage Guidelines
1. Provide column `key` matching server sort whitelist; ensure server enforces allowed fields.
2. Keep `minTableWidth` conservative (760–900) so mobile horizontal scroll is explicit.
3. Use `stickyFirstColumn` only when the first column is an identifying label (avoid wide cells there).
4. Keep accessor functions pure & fast (no network calls; deterministic). If expensive formatting needed, memoize before passing into DataTable.
5. For actions column, keep buttons minimal (icon + tooltip) to reduce horizontal overflow.

### G. Query Param State Hook (`useQueryParamsState`)
1. Always initialize with an object containing default values to avoid undefined branching.
2. When filters change, reset `page` to 1.
3. Avoid writing on every keystroke for large lists; keep local drafts and apply explicitly (see users page pattern).

## 19. Testing Guidance (Lightweight Until Formal Harness Added)
While there is no full automated test suite yet:
1. Add minimal unit tests for pure utilities (e.g., duration parsing) once a test framework is introduced (likely Vitest or Jest). Keep each new utility testable (pure, deterministic, no side effects).
2. For API route changes, manually verify: unauthorized (no token), forbidden (role lacking permission), success (valid token + permission), validation error (bad payload), conflict conditions (unique constraints).
3. Record manual test notes in PR description if no automated tests were added.

## 20. Accessibility / UX Guidelines
1. All interactive elements must have accessible names (button text or `aria-label`).
2. Table sort headers use `aria-sort` already; preserve it when refactoring.
3. Dialogs / confirm prompts should focus trap (use existing shadcn components & wrappers).
4. Color usage: rely on Tailwind semantic tokens (`text-muted-foreground`, etc.) not hard-coded hex values.
5. Keep toast error messages concise; sensitive details (stack traces, SQL) must never be surfaced.

## 21. Performance Considerations
1. Avoid N+1 queries: batch server operations (e.g., count + list via Promise.all as done in pagination util).
2. Prefer server sorting/pagination; keep client table rendering under ~1k rows (current design paginates by default).
3. Debounce high-frequency inputs (future enhancement for search-as-you-type; currently explicit Filter button defers need).
4. Use `next/image` for future large images (currently minimal imagery).

## 22. Secure Coding Additions
1. Never log raw tokens or password hashes. Use partial redaction if debugging.
2. Always catch & map Prisma errors to generic messages; never expose `code` outside controlled cases (e.g., unique violation 409).
3. Enforce `sameSite=strict` & `secure` (already in place) — do not relax without justification.
4. Treat all string env vars as untrusted; validate shapes before use in complex features.
5. When adding file uploads (future), validate MIME/type, size limits, and store outside repo.

## 23. Commit / PR Hygiene (Optional but Recommended)
Prefix commit messages with a conventional type: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `perf:`, `security:`.
Include brief rationale when introducing a new dependency. If adding >1KB gzipped bundle impact, justify clearly.

---
These additions complement earlier sections by giving concrete recipes and guardrails for planned enhancements. Keep this file updated whenever a pattern changes (treat as living architecture doc).
