import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, Forbidden, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const permSet = new Set(auth.user.permissions || []);
    if (!permSet.has(PERMISSIONS.READ_SITES)) {
      return Forbidden();
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: auth.user.id },
      select: { id: true },
    });

    if (!employee) {
      return BadRequest("No employee record linked to current user");
    }

    const assignments = await prisma.siteEmployee.findMany({
      where: { employeeId: employee.id },
      select: {
        site: {
          select: {
            id: true,
            site: true,
            shortName: true,
          },
        },
      },
      orderBy: { site: { site: "asc" } },
    });

    const data = assignments
      .map((a) => a.site)
      .filter(Boolean)
      .map((s) => ({
        id: s.id,
        site: s.site,
        shortName: s.shortName,
      }));

    return Success({ data });
  } catch (e) {
    console.error("Employee attendance my-sites error:", e);
    return ApiError("Failed to fetch assigned sites");
  }
}
