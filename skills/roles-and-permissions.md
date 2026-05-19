# Roles and Permissions

The project uses a granular, database-driven Role-Based Access Control (RBAC) system combined with static configuration for route and API protection.

## Database Schema

Authorization is backed by several Prisma models:
- **`Role`**: Represents a user role (e.g., Admin, Manager).
- **`Permission`**: Represents an individual atomic action (e.g., `READ_USERS`, `EDIT_ENTITIES`).
- **`RolePermission`**: Maps multiple permissions to a role.
- **`UserRole`**: Assigns a role to a user (one role per user/employee).
- **`UserPermission`**: Allows for custom, user-specific permission overrides or additions independent of their role.

The effective permissions for a user are a union of their assigned role's permissions and their individual user permissions.

## Server-Side Authorization

### Middleware
`src/middleware.ts` handles initial authentication. It checks for the presence and validity of the `accessToken` (JWT) cookie. Public paths (like `/login`, static assets, etc.) bypass this check, while protected paths will either redirect to `/login` or return a `401 Unauthorized` for API routes if unauthenticated.

### API Access Guards
`src/lib/access-guard.ts` provides server-side authorization:
- **`guardApiAccess(req)`**: Validates the JWT, retrieves the current user's role and permissions from the database, and checks them against predefined API rules in `src/config/access-control.ts` (`API_ACCESS_RULES`).
- **`guardApiPermissions(req, required)`**: A lower-level helper that ensures the user has all the required permissions provided in the array before allowing the API action to proceed.

## Client-Side Authorization

### Static Configuration
- **`src/config/roles.ts`**: Contains the `PERMISSIONS` object, which provides stable string constants for every atomic permission across the application. It also groups them for UI display (`PERMISSION_GROUPS`).
- **`src/config/access-control.ts`**: Contains `PAGE_ACCESS_RULES`, an array mapping frontend route prefixes to required permissions (e.g., `{ prefix: "/users/new", permissions: [PERMISSIONS.CREATE_USERS] }`).

### Hooks
- **`useCurrentUser` (`src/hooks/use-current-user.ts`)**: Fetches the authenticated user profile along with their computed effective permissions array via SWR.
- **`usePermissions` (`src/hooks/use-permissions.ts`)**: Derives capabilities from `useCurrentUser` and exposes helper functions like `can()`, `canAny()`, and `lacks()` for lightweight conditional rendering in React components.
- **`useProtectPage` (`src/hooks/use-protect-page.ts`)**: A client-side route guard. It matches the current `pathname` against `PAGE_ACCESS_RULES`. If a user lacks required permissions, it automatically redirects or presents an error toast indicating missing access rights.

## Navigation Filtering
The application sidebar (`src/components/layout/sidebar.tsx`) and global search (`src/components/common/global-search.tsx`) utilize the `src/config/nav.ts` configuration. Nav items specify required permissions (`item.permission`), and they are dynamically hidden if the current user's effective permissions do not satisfy the requirement.