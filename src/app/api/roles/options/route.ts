import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/roles/options - minimal role options for select boxes
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const roles = await prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return Success({
      data: roles.map((r) => ({
        id: r.id,
        name: r.name,
      })),
    });
  } catch (error) {
    console.error("Get role options error:", error);
    return ApiError("Failed to fetch role options");
  }
}
