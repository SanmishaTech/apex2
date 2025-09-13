import { NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';

// GET /api/projects?search=&page=1&perPage=10&sort=createdAt&order=desc
// Only projects the caller can see; PROJECT_USER is restricted to its own memberships.
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'createdAt');
  const order = (searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  // Where builder
  type ProjectWhere = {
    OR?: { name?: { contains: string }; clientName?: { contains: string }; location?: { contains: string } }[];
    users?: { some: { userId: number } };
  };
  const where: ProjectWhere = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { clientName: { contains: search } },
      { location: { contains: search } },
    ];
  }
  // Membership restriction for project_user role
  if (user.role === 'project_user') {
    where.users = { some: { userId: user.id } };
  }

  const sortable = new Set(['name','clientName','location','createdAt']);
  const orderBy: Record<string, 'asc' | 'desc'> = sortable.has(sort) ? { [sort]: order } : { createdAt: 'desc' };

  const result = await paginate({
    model: prisma.project,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      name: true,
      clientName: true,
      location: true,
      description: true,
      designImage: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true, files: true } },
    },
  });
  return Success(result);
}

// POST /api/projects  (Admin only enforced via permission guard CREATE_PROJECT)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const contentType = req.headers.get('content-type') || '';
  let name: string | undefined;
  let clientName: string | undefined;
  let location: string | null | undefined;
  let description: string | null | undefined;
  // We'll capture file buffer & metadata first, then create project to get ID, then persist file under /uploads/projects/<id>/designs
  let designImageFile: { buffer: Buffer; originalName: string } | null = null;

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try { form = await req.formData(); } catch { return Error('Invalid multipart form data', 400); }
    name = form.get('name') as string | null || undefined;
    clientName = form.get('clientName') as string | null || undefined;
    location = (form.get('location') as string | null) || null;
    description = (form.get('description') as string | null) || null;
  const file = form.get('designImageFile');
    const isFileLike = (f: unknown): f is { name: string; size: number; type?: string; arrayBuffer: () => Promise<ArrayBuffer> } => {
      if (!f || typeof f !== 'object') return false;
      const o = f as Record<string, unknown> & { arrayBuffer?: unknown };
      return typeof o.name === 'string' && typeof o.size === 'number' && typeof o.arrayBuffer === 'function';
    };
    if (isFileLike(file)) {
  if (!file.type?.startsWith('image/')) return Error('Design image must be an image', 415);
  if (file.size > 20 * 1024 * 1024) return Error('Design image too large (max 20MB)', 413);
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        designImageFile = { buffer: buf, originalName: file.name };
      } catch { return Error('Failed to read design image', 500); }
    }
  } else {
    let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const parsed = body as Partial<{ name: string; clientName: string; location?: string; description?: string }>;
  name = parsed.name; clientName = parsed.clientName; location = parsed.location || null; description = parsed.description || null;
  }
  if (!name) return Error('Name required', 400);
  if (!clientName) return Error('Client name required', 400);

  try {
    // Create project first (without designImage if file pending)
    const created = await prisma.project.create({
      data: {
        name,
        clientName,
        location: location || null,
        description: description || null,
        designImage: null,
      },
      select: { id: true, name: true, clientName: true, location: true, description: true, designImage: true, createdAt: true, updatedAt: true },
    });
    if (designImageFile) {
      const ext = path.extname(designImageFile.originalName) || '.png';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', String(created.id), 'designs');
      await fs.mkdir(dir, { recursive: true });
      try { await fs.writeFile(path.join(dir, filename), designImageFile.buffer); } catch { return Error('Failed to store design image', 500); }
      await prisma.project.update({ where: { id: created.id }, data: { designImage: filename } });
      created.designImage = filename;
    }
    return Success(created, 201);
  } catch {
    return Error('Failed to create project');
  }
}
