import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/projects/:id/users  (list members) - requires READ_PROJECT permission + membership if project_user
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { user } = auth;
  const { id } = await context.params; const pid = Number(id);
  if (Number.isNaN(pid)) return Error('Invalid id', 400);
  // If project_user ensure membership
  if (user.role === 'project_user') {
    const membership = await prisma.projectUser.findFirst({ where: { projectId: pid, userId: user.id }, select: { id: true } });
    if (!membership) return Error('Forbidden', 403);
  }
  const members = await prisma.projectUser.findMany({
    where: { projectId: pid },
    select: { id: true, userId: true, user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { id: 'asc' },
  });
  return Success(members.map(m => ({ id: m.id, userId: m.userId, user: m.user })));
}

// POST /api/projects/:id/users { userId } - add membership - requires MANAGE_PROJECT_USERS
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params; const pid = Number(id);
  if (Number.isNaN(pid)) return Error('Invalid id', 400);
  let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { userId } = body as Partial<{ userId: number | string }>;
  if (userId == null) return Error('userId required', 400);
  const uid = Number(userId); if (Number.isNaN(uid)) return Error('Invalid userId', 400);
  try {
    const created = await prisma.projectUser.create({ data: { projectId: pid, userId: uid }, select: { id: true, projectId: true, userId: true } });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2002') return Error('User already a member', 409);
    if (err.code === 'P2003') return Error('Project or user not found', 404);
    return Error('Failed to add user');
  }
}

// DELETE /api/projects/:id/users { userId } - remove membership - requires MANAGE_PROJECT_USERS
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params; const pid = Number(id);
  if (Number.isNaN(pid)) return Error('Invalid id', 400);
  let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { userId } = body as Partial<{ userId: number | string }>;
  if (userId == null) return Error('userId required', 400);
  const uid = Number(userId); if (Number.isNaN(uid)) return Error('Invalid userId', 400);
  try {
    const deleted = await prisma.projectUser.delete({ where: { projectId_userId: { projectId: pid, userId: uid } }, select: { projectId: true, userId: true } });
    return Success(deleted);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return Error('Membership not found', 404);
    return Error('Failed to remove user');
  }
}
