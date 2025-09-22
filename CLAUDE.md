# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run build:turbo      # Production build with Turbopack
npm run start            # Run production server
npm run lint             # ESLint check

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run/create migrations (dev)
npm run prisma:studio    # Prisma Studio UI
npm run seed             # Seed demo users + refresh tokens

# Utilities
npm run gen:jwt-secret   # Generate random JWT secret (run twice for access/refresh)
```

## Tech Stack & Architecture

This is a Next.js 15 app (App Router) with Prisma/MySQL, JWT auth, and role-based access control (RBAC).

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Prisma ORM, MySQL database
- **Auth**: JWT tokens (access + refresh) with HttpOnly cookies, bcrypt for passwords
- **State**: SWR for data fetching and session management
- **UI**: Radix UI primitives via shadcn/ui, Lucide icons

### Authentication Flow
- Login: POST `/api/auth/login` sets HttpOnly cookies (web) or returns JSON tokens (mobile with `x-client-type: mobile` header)
- Session: `/api/users/me` validates access token via SWR in `useCurrentUser` hook
- Logout: POST `/api/auth/logout` clears cookies
- Refresh token rotation not yet implemented

### Role-Based Access Control (RBAC)
Defined in `src/config/roles.ts`:
- **Roles**: `admin`, `user`, `project_user`
- **Permissions**: Granular permissions like `VIEW:DASHBOARD`, `READ:USERS`, `EDIT:COMPANIES`, etc.
- **Mapping**: `ROLES_PERMISSIONS` object maps roles to their allowed permissions

### Access Control Implementation
- **Client-side**: `usePageAccess()` hook checks permissions via `PAGE_ACCESS_RULES`
- **Server-side**: Middleware currently only enforces authentication (permission enforcement disabled by design)
- **Navigation**: Sidebar filtering based on user permissions (`src/config/nav.ts`)

## Project Structure

```
src/
  app/
    (auth)/           # Login page
    (dashboard)/      # Protected pages (all business modules)
    api/              # API routes (auth, users, all entities)
  components/         # Reusable UI components
  config/
    roles.ts          # RBAC definitions
    nav.ts            # Navigation with permission mapping
    access-control.ts # Page access rules
  hooks/              # SWR hooks for data fetching
  lib/
    jwt.ts            # JWT utilities
    prisma.ts         # Prisma client
    api.ts            # Axios client
    responses.ts      # API response helpers
  types/              # TypeScript types
```

### Business Modules (Dashboard Pages)
The app manages construction/project data with these main entities:
- **Core**: Companies, Sites, Departments, Employees
- **Materials**: Items, Item Categories, Units, Vendors
- **Workforce**: Manpower Suppliers, Manpower (workers), Skill Sets, Categories, Minimum Wages
- **Projects**: BOQs (Bill of Quantities), BOQ Targets, Payment Terms
- **Infrastructure**: Cities, States, Billing Addresses, Notices
- **Project Management**: Projects, Blocks, Crack Identifications, Design Maps

Each module follows the pattern: list page → form component → new/edit pages.

## Database Schema Patterns

### Common Patterns
- All entities have `id`, `createdAt`, `updatedAt`
- Soft delete via status flags where applicable
- Address fields: `addressLine1`, `addressLine2`, `stateId`, `cityId`, `pincode`
- Contact fields: `mobile1`, `mobile2`, `email`, `contactPerson`
- Document storage: URLs stored as strings (under `/uploads/` paths)

### Key Relationships
- **Users** → **Employees** (1:1 optional)
- **Sites** → **Companies** (many:1)
- **Projects** ↔ **Users** (many:many via `ProjectUser`)
- **BOQs** → **Sites** (many:1)
- **Vendors** ↔ **ItemCategories** (many:many via `VendorItemCategory`)

## Development Guidelines

### Adding New Protected Pages
1. Create route under `src/app/(dashboard)/entity-name/`
2. Add nav item in `src/config/nav.ts` with required permission
3. Add rule in `PAGE_ACCESS_RULES` if needed
4. Assign permission to appropriate role in `ROLES_PERMISSIONS`

### Form Components
- Use `react-hook-form` with Zod validation
- Follow existing form patterns in entity directories
- Use shadcn/ui components consistently

### API Development
- Follow existing API patterns in `src/app/api/`
- Use Prisma for database operations
- Implement proper error handling and status codes
- Consider permission checks for sensitive operations

### Database Changes
- Always create migrations: `npm run prisma:migrate`
- Generate client after schema changes: `npm run prisma:generate`
- Update seed file if needed for new entities

## Environment Setup

Required environment variables (see README.md for full details):
```
DATABASE_URL="mysql://user:pass@localhost:3306/dcs"
JWT_ACCESS_SECRET="<random-32+chars>"
JWT_REFRESH_SECRET="<random-64+chars>"
NEXT_PUBLIC_APP_NAME="DCS"
```

## Testing & Quality

- Run `npm run lint` before committing
- No test framework currently configured
- Use TypeScript strictly - fix all type errors before deployment