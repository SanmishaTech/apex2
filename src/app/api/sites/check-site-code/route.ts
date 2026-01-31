import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, BadRequest, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const siteCode = searchParams.get("siteCode")?.trim() || "";
    if (!siteCode) {
      return BadRequest("siteCode is required");
    }

    const excludeIdParam = searchParams.get("excludeId");
    const excludeId = excludeIdParam ? Number(excludeIdParam) : undefined;

    const existing = await prisma.site.findFirst({
      where: {
        siteCode,
        ...(excludeId && !Number.isNaN(excludeId)
          ? { id: { not: excludeId } }
          : {}),
      },
      select: { id: true },
    });

    return Success({ available: !existing });
  } catch (error) {
    console.error("Check site code error:", error);
    return ApiError("Failed to check site code availability");
  }
}
