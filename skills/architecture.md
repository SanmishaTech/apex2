# Architectural Overview

This project is a full-stack web application built using the Next.js App Router paradigm, featuring a robust monolithic architecture.

## System Layers

1. **Presentation Layer (Frontend)**
   - **Framework**: Next.js 14/15 (React 19).
   - **Styling**: Tailwind CSS combined with `shadcn/ui` components for consistent, accessible UI elements.
   - **State Management**: Client-side data fetching and caching are managed using SWR (`useSWR`). Forms are managed and validated using `react-hook-form` and `zod`.
   - **Routing**: Next.js App Router (`src/app/(pages)`) handles UI routing.

2. **API Layer (Backend)**
   - **Framework**: Next.js Route Handlers (`src/app/api`).
   - **Role**: Exposes RESTful endpoints. It handles requests from the client, performs complex business logic, manages authentication/authorization, and interacts with the database.
   - **Response Formatting**: Responses are standardized using a custom wrapper (`src/lib/api-response.ts`), yielding consistent JSON structures (e.g., `Success()`, `ApiError()`).

3. **Data Access Layer**
   - **ORM**: Prisma (`@prisma/client`).
   - **Role**: Provides a type-safe abstraction over the SQL database. All queries, mutations, and bulk operations are routed through a singleton Prisma client (`src/lib/prisma.ts`).

4. **Storage Layer**
   - **Database**: MySQL. Schema defined via `prisma/schema.prisma`.
   - **File Storage**: Local disk storage. Files (images, PDFs, Excel templates) are saved to the `uploads/` directory on the server file system.

## Data Flow
1. **Client Request**: A user interacts with the UI. The client executes an HTTP request via the internal `api-client.ts` wrapper (which wraps `axios` or native `fetch`).
2. **Middleware**: Next.js `middleware.ts` intercepts the request. It verifies the JWT access token cookie. If invalid, the request is rejected early.
3. **API Handler**: The request reaches the Route Handler (`route.ts`).
4. **Access Control**: `guardApiAccess` is invoked to retrieve the user's DB-backed permissions and ensure they have the necessary rights to perform the action.
5. **Business Logic & DB**: The handler executes the required logic, using Prisma to read from or write to the MySQL database.
6. **Response**: A standardized JSON payload or file buffer is returned to the client, which SWR processes to update the UI state.

## Service Boundaries
The application is structured into domain-specific modules (e.g., Users, Products, Orders, Settings). While it operates as a monolith, these modules remain somewhat logically separated via distinct database tables, dedicated API namespaces (e.g., `/api/orders`), and isolated React context/hooks. Cross-domain relationships are enforced at the database level via foreign keys mapped in `schema.prisma`.
