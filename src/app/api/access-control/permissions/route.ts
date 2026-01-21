import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/access-control/permissions - list permissions
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { permissionName: "asc" },
      select: { id: true, permissionName: true, description: true, createdAt: true, updatedAt: true },
    });
    return Success({ data: permissions });
  } catch (e) {
    console.error("List permissions error:", e);
    return Error("Failed to fetch permissions");
  }
}
