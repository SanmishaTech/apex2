import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/sites/options - minimal site options for select boxes
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const sites = await prisma.site.findMany({
      select: { id: true, site: true },
      orderBy: { site: "asc" },
      take: 1000,
    });
    return Success({ data: sites });
  } catch (error) {
    console.error("Get site options error:", error);
    return ApiError("Failed to fetch site options");
  }
}
