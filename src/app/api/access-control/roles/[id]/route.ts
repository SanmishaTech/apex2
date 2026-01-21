import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

// GET /api/access-control/roles/:id - role details incl. assigned permissions
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const roleId = Number(id);
  if (Number.isNaN(roleId)) return BadRequest("Invalid role id");

  try {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            permission: { select: { id: true, permissionName: true } },
          },
        },
        _count: { select: { users: true } },
      },
    });

    if (!role) return NotFound("Role not found");

    const permissionNames = (role.permissions || [])
      .map((rp) => rp.permission.permissionName)
      .filter(Boolean);

    return Success({
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      usersCount: role._count.users,
      permissionNames,
    });
  } catch (e) {
    console.error("Get role error:", e);
    return Error("Failed to fetch role");
  }
}

// PATCH /api/access-control/roles/:id - update role name/description
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const roleId = Number(id);
  if (Number.isNaN(roleId)) return BadRequest("Invalid role id");

  try {
    const body = await req.json();
    const parsed = updateRoleSchema.parse(body);

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(parsed.name ? { name: parsed.name.trim() } : {}),
        ...("description" in parsed ? { description: parsed.description ?? null } : {}),
      },
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });

    return Success(updated);
  } catch (e: any) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    if (e?.code === "P2025") return NotFound("Role not found");
    if (e?.code === "P2002") return Error("Role name already exists", 409);
    console.error("Update role error:", e);
    return Error("Failed to update role");
  }
}
