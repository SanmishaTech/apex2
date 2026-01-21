import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional().nullable(),
});

// GET /api/access-control/roles - list roles
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permissions: true, users: true } },
      },
    });
    return Success({ data: roles });
  } catch (e) {
    console.error("List roles error:", e);
    return Error("Failed to fetch roles");
  }
}

// POST /api/access-control/roles - create role
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createRoleSchema.parse(body);

    const created = await prisma.role.create({
      data: {
        name: parsed.name.trim(),
        description: parsed.description ?? null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(created, 201);
  } catch (e: any) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    if (e?.code === "P2002") return Error("Role already exists", 409);
    console.error("Create role error:", e);
    return Error("Failed to create role");
  }
}
