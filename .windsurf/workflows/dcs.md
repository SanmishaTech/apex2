---
description: Complete DCS development workflow following coding standards
auto_execution_mode: 1
---

## 🏗️ Feature Development
### 1. Planning
- Review `/src` architecture patterns
- Check `config/roles.ts` permissions
- Create branch: `git checkout -b feature/name`
 
Run: `npx prisma migrate dev --name add_entity && npm run prisma:generate`

### 3. Permissions
```typescript
// config/roles.ts
export const PERMISSIONS = {
  READ_ENTITY: 'READ:ENTITY',
  EDIT_ENTITY: 'EDIT:ENTITY',
  DELETE_ENTITY: 'DELETE:ENTITY',
} as const;

// Update ROLES_PERMISSIONS and config/access-control.ts API_ACCESS_RULES
```

### 4. API Development
```typescript
// src/app/api/entities/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET - List with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const result = await paginate({
      model: prisma.entity,
      where,
      orderBy: { createdAt: "desc" },
      page,
      perPage,
      select: { id: true, name: true, description: true, status: true }
    });

    return Success(result);
  } catch (error) {
    console.error("Get entities error:", error);
    return Error("Failed to fetch entities");
  }
}

// POST - Create with validation
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { name, description } = createSchema.parse(body);
    
    const created = await prisma.entity.create({
      data: { name, description, createdById: auth.user.id },
      select: { id: true, name: true, description: true }
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Entity already exists', 409);
    }
    return Error("Failed to create entity");
  }
}
```

```typescript
// src/app/api/entities/[id]/route.ts - Individual operations
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const updateData = createSchema.partial().parse(body);

    const updated = await prisma.entity.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, description: true }
    });

    return Success(updated);
  } catch (error) {
    if (error.code === 'P2025') return NotFound('Entity not found');
    return Error("Failed to update entity");
  }
}
```

### 5. Frontend Development

#### 5.1. Type Definitions
```typescript
// src/types/entities.ts
export interface Entity {
  id: number;
  name: string;
  description?: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EntitiesResponse {
  data: Entity[];
  meta: { page: number; perPage: number; total: number; totalPages: number; };
}
```

#### 5.2. Page Component Structure
```typescript
// src/app/(dashboard)/entities/page.tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { usePermissions } from '@/hooks/use-permissions';
import { useProtectPage } from '@/hooks/use-page-access';
import { PERMISSIONS } from '@/config/roles';
import { DataTable, Column } from '@/components/common/data-table';
import { AppButton } from '@/components/ui/app-button';
import { toast } from 'sonner';

export default function EntitiesPage() {
  const { loading, allowed } = useProtectPage();
  const { can } = usePermissions();
  
  const [qp, setQp] = useQueryParamsState({
    page: 1, perPage: 10, search: '', sort: 'createdAt', order: 'desc',
  });

  const query = `/api/entities?page=${qp.page}&perPage=${qp.perPage}&search=${qp.search}`;
  const { data, isLoading, mutate } = useSWR<EntitiesResponse>(query, apiGet);

  if (loading || !allowed) return <div>Loading...</div>;

  const columns: Column<Entity>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      accessor: (r) => r.name,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status ? 'Active' : 'Inactive',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Entities</h1>
        {can(PERMISSIONS.EDIT_ENTITY) && (
          <AppButton onClick={() => setCreateOpen(true)}>Create Entity</AppButton>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        pagination={{
          page: qp.page,
          perPage: qp.perPage,
          total: data?.meta.total || 0,
          onPageChange: (page) => setQp({ ...qp, page }),
        }}
        renderRowActions={(item) => (
          {can(PERMISSIONS.EDIT_ENTITY) && (
            <AppButton variant="outline" size="sm">Edit</AppButton>
          )}
        )}
      />
    </div>
  );
}
```

#### 5.3. Form Components with react-hook-form + Zod
```typescript
// src/app/(dashboard)/entities/create-dialog.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AppButton } from '@/components/ui/app-button';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export function CreateEntityDialog({ open, onOpenChange, onSubmit }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      // Error handling in parent component
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Entity</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3">
              <AppButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </AppButton>
              <AppButton type="submit">Create</AppButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6. File Upload Pattern
```typescript
// Handle file uploads in API routes
if (contentType.includes('multipart/form-data')) {
  const form = await req.formData();
  const file = form.get('file') as File;
  
  if (!file.type?.startsWith('image/')) {
    return Error('File must be an image', 415);
  }
  if (file.size > 20 * 1024 * 1024) {
    return Error('File too large (max 20MB)', 413);
  }
  
  const ext = path.extname(file.name) || '.png';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'entities');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
}
```

### 7. Styling & UI Standards
```typescript
// Use semantic Tailwind classes with design system
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
      },
    },
  }
);

// Responsive design patterns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card className="p-6">
    <CardHeader>
      <CardTitle className="text-lg font-semibold">{entity.name}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">{entity.description}</p>
    </CardContent>
  </Card>
</div>
```

### 8. Error Handling Patterns
```typescript
// Frontend error handling with toast notifications
try {
  await apiPost('/api/entities', data);
  toast.success('Entity created successfully');
  await mutate(); // Revalidate SWR cache
} catch (error) {
  toast.error((error as Error).message);
}

// Component error boundaries
if (error) return <ErrorMessage error={error} />;
if (isLoading) return <LoadingSkeleton />;

// Backend structured error responses
try {
  // Business logic
} catch (error) {
  if (error instanceof z.ZodError) {
    return BadRequest(error.errors);
  }
  if (error.code === 'P2002') {
    return Error('Resource already exists', 409);
  }
  console.error("Operation failed:", error);
  return Error("Internal server error");
}
```

### 7. Navigation
Update `src/config/nav.ts` with new routes and permission requirements.

## 🔍 Quality Assurance

### Code Review Checklist
- [ ] Imports follow order (React → Third-party → Internal → Relative)
- [ ] TypeScript interfaces for all components
- [ ] API routes use `guardApiAccess` + Zod validation
- [ ] Permission checks for protected operations
- [ ] Database queries use `select` for performance
- [ ] File names: kebab-case, Components: PascalCase
- [ ] Error handling with structured responses

### Security Review
- [ ] All API routes protected with access guards
- [ ] Input validation with Zod schemas  
- [ ] No sensitive data in error messages
- [ ] Proper HTTP status codes

### Performance Review
- [ ] Database indexes for query columns
- [ ] Pagination for list endpoints
- [ ] SWR caching configured
- [ ] Component memoization where needed


### Post-deployment Verification
- [ ] API endpoints respond correctly
- [ ] Authentication/authorization working
- [ ] Database migrations applied
- [ ] UI renders across devices

## 📝 Final Steps
---

**Reference CODING_STANDARDS.md for detailed implementation patterns. Follow this workflow exactly for consistency.**