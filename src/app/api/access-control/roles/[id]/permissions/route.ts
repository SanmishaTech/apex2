import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const setPermissionsSchema = z.object({
  permissionNames: z.array(z.string().min(1)).default([]),
});

// PUT /api/access-control/roles/:id/permissions - replace role permissions
export async function PUT(
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
    const parsed = setPermissionsSchema.parse(body);

    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) return NotFound("Role not found");

    const uniqueNames = Array.from(new Set(parsed.permissionNames.map((p) => p.trim()).filter(Boolean)));

    const perms = uniqueNames.length
      ? await prisma.permission.findMany({
          where: { permissionName: { in: uniqueNames } },
          select: { id: true, permissionName: true },
        })
      : [];

    const foundNames = new Set(perms.map((p) => p.permissionName));
    const missing = uniqueNames.filter((n) => !foundNames.has(n));
    if (missing.length) {
      return BadRequest(`Unknown permission(s): ${missing.join(", ")}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (perms.length) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    });

    return Success({ ok: true, roleId, permissionNames: uniqueNames });
  } catch (e: any) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    console.error("Set role permissions error:", e);
    return Error("Failed to update role permissions");
  }
}
