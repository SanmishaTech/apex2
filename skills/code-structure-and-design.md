# Code Structure and Design

The codebase adheres to a modular, feature-based organization built around the Next.js App Router, emphasizing separation of concerns and reusability.

## Folder Structure

The core of the application resides in the `src/` directory.

- **`src/app/`**: Contains the Next.js file-system based routing.
  - `api/`: Backend Route Handlers serving REST API endpoints. Organized by domain (e.g., `api/users`, `api/products`).
  - `(pages)` or root subdirectories: Frontend pages (UI routes).
- **`src/components/`**: React components hierarchy.
  - `ui/`: Generic, highly reusable base components (predominantly `shadcn/ui` built on Radix UI, like Button, Dialog, Select).
  - `common/`: Shared application-specific components used across different domains (e.g., `app-table.tsx`, `global-search.tsx`, `app-form.tsx`).
  - `layout/`: Global layout structures (e.g., `sidebar.tsx`, `user-nav.tsx`).
  - `forms/`: Complex, domain-specific form components (e.g., `product-form.tsx`).
- **`src/hooks/`**: Custom React hooks for encapsulating logic. Includes data fetching (SWR abstractions), state management, and auth context (e.g., `use-current-user.ts`, `use-permissions.ts`).
- **`src/lib/`**: Utility functions, generic helpers, and singleton instances. Contains server-side and client-side utilities (e.g., `prisma.ts`, `api-client.ts`, `upload.ts`, `jwt.ts`, `utils.ts` for Tailwind merging).
- **`src/config/`**: Static configuration data, constants, and settings (e.g., `roles.ts`, `nav.ts`, `access-control.ts`).
- **`src/types/`**: TypeScript type definitions and interfaces. Ensures type safety across API boundaries and component props.
- **`prisma/`**: Database configuration. Contains `schema.prisma` (the source of truth for the data model), migrations, and seed scripts.

## Design Patterns

- **Singleton Pattern**: Database connection pooling is managed via a singleton pattern (`src/lib/prisma.ts`) to prevent exhaustion of connection limits during development hot-reloads.
- **Adapter/Wrapper Pattern**: 
  - `api-client.ts` wraps HTTP libraries (Axios/Fetch) to standardize error handling and request interception.
  - `api-response.ts` standardizes API endpoint outputs (`Success`, `ApiError`).
- **Provider Pattern**: Global states like theme and context are injected at the root layout using React Context Providers (`src/providers/theme-provider.tsx`).
- **Compound Components**: Many UI elements (like Dialogs and Dropdown Menus from Radix UI) use compound component patterns for flexible composition.

## Key Libraries
- **Tailwind CSS**: Utility-first CSS framework for rapid UI styling.
- **Prisma**: Type-safe ORM for database queries and schema management.
- **SWR**: React Hooks for remote data fetching, caching, and mutation.
- **Zod & React Hook Form**: Form validation and state management.
- **XLSX & jsPDF**: Used heavily for import/export capabilities.
- **Jose**: Used for secure JWT signing and verification.

## Naming Conventions and Standards
- **Files/Folders**: Kebab-case (`my-component.tsx`, `feature-name`).
- **React Components**: PascalCase (`FeatureSpecificForm`, `Button`).
- **Hooks**: CamelCase prefixed with `use` (`useCurrentUser`).
- **Functions/Variables**: CamelCase (`handleFileUpload`, `validateInput`).
- **Constants**: UPPER_SNAKE_CASE (`API_ACCESS_RULES`, `PERMISSIONS`).
- **TypeScript**: Strict typing is enforced. Interfaces are preferred over types for object shapes. `any` is avoided unless interacting with untyped third-party libraries.