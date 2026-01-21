import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const setPermissionsSchema = z.object({
  permissionNames: z.array(z.string().min(1)).default([]),
});

// GET /api/access-control/users/:id/permissions - list user-specific permissions
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const userId = Number(id);
  if (Number.isNaN(userId)) return BadRequest("Invalid user id");

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        userPermissions: {
          select: {
            permission: { select: { permissionName: true } },
          },
        },
      },
    });

    if (!user) return NotFound("User not found");

    const permissionNames =
      user.userPermissions
        ?.map((up) => up.permission.permissionName)
        .filter(Boolean) ?? [];

    return Success({
      id: user.id,
      name: user.name,
      email: user.email,
      permissionNames,
    });
  } catch (e) {
    console.error("Get user permissions error:", e);
    return Error("Failed to fetch user permissions");
  }
}

// PUT /api/access-control/users/:id/permissions - replace user-specific permissions
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const userId = Number(id);
  if (Number.isNaN(userId)) return BadRequest("Invalid user id");

  try {
    const body = await req.json();
    const parsed = setPermissionsSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NotFound("User not found");

    const uniqueNames = Array.from(
      new Set(parsed.permissionNames.map((p) => p.trim()).filter(Boolean))
    );

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
      await tx.userPermission.deleteMany({ where: { userId } });
      if (perms.length) {
        await tx.userPermission.createMany({
          data: perms.map((p) => ({ userId, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    });

    return Success({ ok: true, userId, permissionNames: uniqueNames });
  } catch (e: any) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    console.error("Set user permissions error:", e);
    return Error("Failed to update user permissions");
  }
}
