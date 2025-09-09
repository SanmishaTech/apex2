# DCS Project Coding Standards

This document defines the comprehensive coding standards for the DCS (Document Control System) project. These standards must be followed for all development work.

## 🏗️ Project Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: Node.js >=20.16.0 <21
- **Language**: TypeScript (strict: false, noImplicitAny: false)
- **Database**: MySQL with Prisma ORM
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**: SWR for server state
- **Authentication**: JWT with refresh tokens
- **Authorization**: RBAC (Role-Based Access Control)

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth route group (login, etc.)
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API route handlers
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # Base shadcn/ui components
│   ├── common/            # Reusable business components
│   └── layout/            # Layout-specific components
├── config/                # Configuration files
│   ├── access-control.ts  # Page & API access rules
│   ├── roles.ts           # RBAC definitions
│   └── nav.ts             # Navigation structure
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
└── types/                 # TypeScript type definitions
```

## 🔐 Authentication & Authorization

### JWT Implementation
- Use `jose` library for JWT operations
- Access tokens: 15 minutes expiry (configurable via JWT_ACCESS_EXPIRES)
- Refresh tokens: 30 days (remember me) or 1 day (default)
- Store tokens in HttpOnly cookies for web clients
- Return tokens in response body for mobile clients (x-client-type: mobile)

### Access Control Pattern
```typescript
// 1. Define permissions in config/roles.ts
export const PERMISSIONS = {
  READ_USERS: 'READ:USERS',
  EDIT_USERS: 'EDIT:USERS',
  // ... more permissions
} as const;

// 2. Map roles to permissions
export const ROLES_PERMISSIONS = {
  [ROLES.ADMIN]: [...Object.values(PERMISSIONS)],
  [ROLES.USER]: [PERMISSIONS.READ_USERS, /*...*/],
  [ROLES.PROJECT_USER]: [PERMISSIONS.READ_PROJECT, /*...*/],
} as const;

// 3. Configure access rules in config/access-control.ts
export const API_ACCESS_RULES: ApiAccessRule[] = [
  {
    prefix: '/api/users',
    methods: {
      GET: [PERMISSIONS.READ_USERS],
      POST: [PERMISSIONS.EDIT_USERS],
      PATCH: [PERMISSIONS.EDIT_USERS],
      DELETE: [PERMISSIONS.DELETE_USERS],
    },
  },
  // ... more rules
];
```

### API Route Security
```typescript
// Always start API routes with access guard
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { user } = auth;
  
  // Your route logic here
}
```

## 🗄️ Database Patterns

### Prisma Schema Conventions
- Use camelCase for field names
- Include `createdAt` and `updatedAt` for all entities
- Add appropriate indexes for query performance
- Use cascading deletes where appropriate
- Include descriptive comments for complex models

### Model Structure Example
```prisma
model User {
  id                      Int            @id @default(autoincrement())
  name                    String?
  email                   String         @unique
  passwordHash            String
  role                    String
  status                  Boolean        @default(true)
  lastLogin               DateTime?
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt
  
  // Relations
  refreshTokens           RefreshToken[]
  projectUsers            ProjectUser[]
  
  @@index([role])
  @@index([email])
}
```

### Database Access
- Always use the singleton Prisma client from `@/lib/prisma`
- Use transaction for multi-model operations
- Implement proper error handling for database operations
- Use `select` to limit returned fields for performance

## 🔌 API Development

### Route Handler Structure
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

// Define validation schema
const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { name, email } = createSchema.parse(body);
    
    const created = await prisma.user.create({
      data: { name, email },
      select: { id: true, name: true, email: true }
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create error:", error);
    return Error("Failed to create resource");
  }
}
```

### API Response Patterns
- Use standardized response helpers from `@/lib/api-response`
- Always validate input with Zod schemas
- Include proper HTTP status codes
- Handle Prisma errors appropriately (P2002 for unique constraint, P2025 for not found)
- Log errors with context

### File Upload Pattern
```typescript
// Handle multipart form data
if (contentType.includes('multipart/form-data')) {
  const form = await req.formData();
  const file = form.get('file') as File;
  
  // Validate file type and size
  if (!file.type?.startsWith('image/')) {
    return Error('File must be an image', 415);
  }
  if (file.size > 20 * 1024 * 1024) {
    return Error('File too large (max 20MB)', 413);
  }
  
  // Generate unique filename and save
  const ext = path.extname(file.name) || '.png';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'folder');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
}
```

### Pagination Implementation
```typescript
import { paginate } from "@/lib/paginate";

// In route handler
const { searchParams } = new URL(req.url);
const page = Math.max(1, Number(searchParams.get("page")) || 1);
const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
const search = searchParams.get("search")?.trim() || "";

// Build where clause
const where: UserWhere = {};
if (search) {
  where.OR = [
    { name: { contains: search } },
    { email: { contains: search } },
  ];
}

const result = await paginate({
  model: prisma.user,
  where,
  orderBy: { createdAt: "desc" },
  page,
  perPage,
  select: { id: true, name: true, email: true }
});

return Success(result);
```

## ⚛️ Frontend Development

### Component Architecture
- Use functional components with TypeScript
- Implement proper prop interfaces
- Use `"use client"` directive for client components
- Prefer composition over inheritance
- Keep components focused on single responsibility

### Component Structure Example
```typescript
'use client';

interface UserCardProps {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-sm text-muted-foreground">{user.email}</p>
      {/* Actions */}
    </div>
  );
}
```

### State Management Patterns
```typescript
// Use SWR for server state
const { data, error, isLoading, mutate } = useSWR<UsersResponse>(
  query,
  apiGet
);

// Use query params for filter/pagination state
const [qp, setQp] = useQueryParamsState({
  page: 1,
  perPage: 10,
  search: '',
  sort: 'createdAt',
  order: 'desc',
});

// Use local state for form drafts
const [searchDraft, setSearchDraft] = useState(search);
```

### Data Table Pattern
```typescript
// Define columns with proper typing
const columns: Column<UserListItem>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    accessor: (r) => r.name || '—',
    cellClassName: 'font-medium whitespace-nowrap',
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    accessor: (r) => <StatusBadge active={r.status} />,
    cellClassName: 'whitespace-nowrap',
  },
];

// Use with proper sorting state
<DataTable
  columns={columns}
  data={data?.data || []}
  loading={isLoading}
  sort={sortState}
  onSortChange={(s) => toggleSort(s.field)}
  stickyColumns={1}
  renderRowActions={(user) => (
    <div className="flex">
      {can(PERMISSIONS.EDIT_USERS) && (
        <EditButton onClick={() => handleEdit(user.id)} />
      )}
    </div>
  )}
/>
```

### Permission-Based Rendering
```typescript
// Use permissions hook
const { can } = usePermissions();

// Conditional rendering
{can(PERMISSIONS.EDIT_USERS) && (
  <AppButton onClick={handleCreate}>Add User</AppButton>
)}

// Page protection
const { loading, allowed } = useProtectPage();
if (loading || !allowed) return <LoadingSpinner />;
```

## 🎨 Styling & UI Standards

### Tailwind CSS Patterns
- Use semantic class names with CSS variables for colors
- Leverage design system tokens from tailwind.config.js
- Use responsive prefixes (md:, lg:) for adaptive layouts
- Implement dark mode support with CSS variables

### Color System
```css
/* Use semantic color variables */
.primary-button {
  @apply bg-primary text-primary-foreground hover:bg-primary/90;
}

.card {
  @apply bg-card text-card-foreground border border-border;
}
```

### Component Styling Conventions
- Use `cn()` utility for conditional classes
- Implement variant-based styling with `class-variance-authority`
- Add proper focus states and accessibility attributes
- Use consistent spacing scale (4px increments)

### Button Variants Example
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## 🪝 Hook Patterns

### Custom Hook Structure
```typescript
// Always use "use" prefix and TypeScript
export function useApiData<T>(endpoint: string) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    endpoint,
    apiGet,
    { shouldRetryOnError: false }
  );
  
  return {
    data: data ?? null,
    error,
    isLoading,
    refetch: mutate
  };
}
```

### Form Handling
```typescript
// Use react-hook-form with Zod validation
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {
    name: '',
    email: '',
  }
});

const handleSubmit = form.handleSubmit(async (data) => {
  try {
    await apiPost('/api/users', data);
    toast.success('User created');
    router.push('/users');
  } catch (error) {
    toast.error(error.message);
  }
});
```

## 📁 File Organization

### Naming Conventions
- **Files**: kebab-case (`user-profile.tsx`, `api-client.ts`)
- **Components**: PascalCase (`UserProfile`, `DataTable`)
- **Hooks**: camelCase with "use" prefix (`useCurrentUser`, `usePermissions`)
- **Types/Interfaces**: PascalCase (`UserListItem`, `ApiResponse`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`, `PERMISSIONS`)

### Import Organization
```typescript
// 1. React/Next.js imports
import React from 'react';
import { NextRequest } from 'next/server';

// 2. Third-party libraries
import { z } from 'zod';
import useSWR from 'swr';

// 3. Internal imports (absolute paths)
import { apiGet } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';

// 4. Relative imports
import './styles.css';
```

### Directory Structure Guidelines
- Keep related files together in feature directories
- Separate UI components from business logic components
- Use index files for clean imports
- Group utility functions by domain

## 🧪 Error Handling

### Frontend Error Patterns
```typescript
// API calls with error handling
try {
  await apiPost('/api/users', data);
  toast.success('Success message');
  await mutate(); // Revalidate SWR cache
} catch (error) {
  toast.error((error as Error).message);
}

// Component error boundaries
if (error) {
  return <ErrorMessage error={error} />;
}

if (isLoading) {
  return <LoadingSkeleton />;
}
```

### Backend Error Handling
```typescript
// Structured error responses
try {
  // Business logic
} catch (error) {
  if (error instanceof z.ZodError) {
    return BadRequest(error.errors);
  }
  if (error.code === 'P2002') {
    return Error('Resource already exists', 409);
  }
  console.error('Operation failed:', error);
  return Error('Internal server error');
}
```

## 🔧 Configuration Management

### Environment Variables
```bash
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/db"

# JWT Configuration
JWT_SECRET="your-secret-key"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="30d"
JWT_REFRESH_EXPIRES_SHORT="1d"

# Application
NODE_ENV="development"
NEXT_PUBLIC_API_BASE=""
```

### Configuration Files
- Keep sensitive config in environment variables
- Use typed configuration objects
- Validate configuration at startup
- Provide sensible defaults

## 📝 Code Quality Standards

### TypeScript Configuration
- Use `strict: false` and `noImplicitAny: false` for gradual typing
- Prefer explicit types for public APIs
- Use `unknown` instead of `any` when possible
- Leverage type inference for local variables

### Code Style Rules
- Use ESLint with Next.js configuration
- Format with Prettier (configured via ESLint)
- Maximum line length: 100 characters
- Use 2-space indentation
- Include trailing commas
- Use single quotes for strings

### Performance Considerations
- Use `React.memo()` for expensive components
- Implement proper key props in lists
- Lazy load heavy components
- Optimize images with Next.js Image component
- Use SWR's built-in caching and deduplication

## 🚀 Development Workflow

### Scripts Usage
```bash
# Development
npm run dev              # Start with Turbopack
npm run build           # Production build
npm run start           # Production server

# Database
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:studio   # Open Prisma Studio
npm run seed           # Seed database

# Utilities
npm run lint           # ESLint check
npm run gen:jwt-secret # Generate JWT secret
```

### Git Commit Conventions
- Use conventional commits format
- Reference issue numbers when applicable
- Keep commits atomic and focused
- Write descriptive commit messages

### Testing Guidelines
- Write unit tests for utility functions
- Test API endpoints with proper mock data
- Test user interactions in components
- Ensure proper error state handling

## 🔍 Security Best Practices

### Authentication Security
- Use HttpOnly cookies for token storage
- Implement proper token expiration
- Validate tokens on every request
- Use secure cookie flags in production

### Data Validation
- Validate all inputs with Zod schemas
- Sanitize user inputs
- Use parameterized queries (Prisma handles this)
- Implement rate limiting for sensitive endpoints

### Authorization Checks
- Always check permissions in API routes
- Use the access guard system consistently
- Implement resource-level authorization where needed
- Audit permission changes carefully

## 📚 Documentation Standards

### Code Comments
- Document complex business logic
- Explain non-obvious technical decisions
- Use JSDoc for public APIs
- Keep comments concise and relevant

### API Documentation
- Document all API endpoints
- Include request/response examples
- Specify required permissions
- Document error responses

---

**This document should be referenced for all development work on the DCS project. When in doubt, follow the established patterns found in the existing codebase.**
