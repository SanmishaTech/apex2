<div align="center">

# DCS Dashboard

Role & permission‑aware starter (Next.js App Router, Prisma, JWT auth, Tailwind, Shadcn/Radix UI, SWR).

</div>

## Stack

- Next.js 15 (App Router, Turbopack)
- TypeScript, ESLint
- Tailwind CSS + shadcn/ui (Radix primitives)
- Prisma (MySQL)
- JWT auth (access + refresh) with `jose`
- SWR for session fetching
- Axios API client

## Features

- Email/password login (bcrypt hash stored as `passwordHash`)
- HttpOnly cookie storage of access & refresh tokens (web) OR JSON body tokens (set `x-client-type: mobile`)
- Refresh tokens persisted in DB (`RefreshToken` model) – refresh endpoint not yet implemented
- Basic role / permission model (`src/config/roles.ts`)
- Navigation filtered by permissions (`src/config/nav.ts` + role mapping)
- Client page access helper hook (`usePageAccess`) using `PAGE_ACCESS_RULES`
- (Server) Middleware currently enforces authentication only (permission enforcement disabled by design for now)
- Dark / light theme toggle

## Quick Start

1. Install deps:
	```bash
	npm install
	```
2. Create a MySQL database and set `DATABASE_URL` in `.env` (see Environment section).
3. Generate Prisma client & run migrations:
	```bash
	npx prisma migrate dev
	```
4. Seed demo users (admin + user):
	```bash
	npm run seed
	```
5. Generate JWT secrets (writes to console – copy into `.env`):
	```bash
	npm run gen:jwt-secret
	```
	Run twice (one for access, one for refresh) or edit the script to output both.
6. Start dev server:
	```bash
	npm run dev
	```
7. Visit `http://localhost:3000/login` and use:
	- admin: `admin@demo.com` / `abcd123`
	- user:  `user@demo.com`  / `abcd123`

## Environment Variables

Create `.env` (never commit secrets):

```
DATABASE_URL="mysql://user:pass@localhost:3306/dcs"
JWT_ACCESS_SECRET="<random-32+chars>"
JWT_REFRESH_SECRET="<random-64+chars>"
JWT_ACCESS_EXPIRES=15m            # optional override
JWT_REFRESH_EXPIRES=30d           # long session (remember me)
JWT_REFRESH_EXPIRES_SHORT=1d      # short session
NEXT_PUBLIC_APP_NAME="DCS"
# NEXT_PUBLIC_API_BASE="http://localhost:3000"  # usually omit; axios uses same origin
```

Durations accept number + unit (m|h|d). Parsing implemented in `parseDurationMs`.

## Auth Flow (Web)

1. User POSTs `/api/auth/login` with email, password, optional `remember`.
2. On success: access + refresh tokens set as HttpOnly cookies.
3. Client loads `/api/users/me` (SWR in `useCurrentUser`). Access token must be valid.
4. Logout POST `/api/auth/logout` clears cookies.
5. (Not yet implemented) A refresh endpoint could rotate refresh tokens and issue a new access token when expired.

For mobile / non-browser clients set header `x-client-type: mobile` – tokens return in JSON instead of cookies.

## Roles & Permissions

Defined in `src/config/roles.ts`:

- Roles: `admin`, `user`
- Permissions (examples): `VIEW:DASHBOARD`, `VIEW:USER`, `EDIT:USER`, etc.

Mapping (`ROLES_PERMISSIONS`) powers:

- Sidebar filtering (`sidebar.tsx`)
- Page access checks (`usePageAccess`) via `PAGE_ACCESS_RULES` (`src/config/access-control.ts`)

### Access Control

`PAGE_ACCESS_RULES` / `API_ACCESS_RULES` specify required permission arrays *per path prefix*.

Server Middleware (current) in `middleware.ts` does only auth check. If you want server‑side permission enforcement again, reintroduce the previous rule lookup (see commented commit history) using `findAccessRule(pathname)` and role permissions.

Client guard still runs for pages: `usePageAccess()` returns `{ allowed, checking }`; dashboard layout redirects if not allowed.

## Project Structure (Key Paths)

```
src/
  app/               # App Router routes
	 (dashboard)/     # Protected area
	 api/             # Route handlers (auth, users)
  components/        # UI + layout
  config/            # nav, roles, access-control rules
  hooks/             # SWR hooks (user, page access)
  lib/               # jwt, prisma, api client, responses
  types/             # shared types
prisma/              # schema + migrations + seed
middleware.ts        # global auth middleware
```

## Scripts

| Script | Purpose |
| ------ | ------- |
| `dev` | Start dev server (Turbopack) |
| `build` | Production build |
| `start` | Run production server |
| `lint` | ESLint check |
| `prisma:migrate` | Run/create migrations (dev) |
| `prisma:generate` | Generate Prisma client |
| `prisma:studio` | Prisma Studio UI |
| `seed` | Seed demo users + refresh tokens |
| `gen:jwt-secret` | Generate random secret (run twice for access/refresh) |

## API Endpoints (Implemented)

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/auth/login` | Login; sets cookies or returns tokens |
| POST | `/api/auth/logout` | Clear auth cookies |
| GET  | `/api/users/me` | Current user profile |

## Adding a Protected Page

1. Create route under `src/app/(dashboard)/yourpage/page.tsx`.
2. Add nav item (optional) in `src/config/nav.ts` with required permission.
3. Add rule in `PAGE_ACCESS_RULES` if not covered (e.g. `{ prefix: '/yourpage', permissions: [PERMISSIONS.VIEW_DASHBOARD] }`).
4. Assign permission to appropriate role in `ROLES_PERMISSIONS`.

## Re‑enabling Permission Enforcement in Middleware (Optional)

Replace middleware body with logic that:

1. Finds rule via `findAccessRule(pathname)`.
2. Verifies token & extracts role.
3. Compares required permissions to `ROLES_PERMISSIONS[role]`.
4. Returns 403 / redirect if missing.

Client guard can remain as a UX enhancement (faster feedback, conditional UI).

## Security Notes

- No rate limiting / brute force protection yet.
- No refresh token rotation or revocation logic (only stored). Add rotation + invalidation for production.
- Password reset / email verification placeholders not implemented.
- Consider CSRF: cookies are HttpOnly + sameSite=strict; API is same origin; adjust if adding cross-site use cases.

## Next Ideas

- Refresh endpoint (`/api/auth/refresh`) with rotation + reuse detection
- Audit log for auth events
- Granular permission editor UI
- Soft-delete users & status toggles in UI
- Optimistic UI for user management

## License

Internal / Unlicensed (add a license if distributing).

---

For questions or improvements: open an issue or extend the config files directly.
