import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest as ApiBadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";

// GET /api/employee-assignments?siteId=123&mode=assigned|available&search=&page=&perPage=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(10000, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = (searchParams.get("search") || "").trim();
    const mode = (searchParams.get("mode") || "assigned").toLowerCase();
    const siteId = Number(searchParams.get("siteId"));

    if (mode === "assigned" && (Number.isNaN(siteId) || !siteId)) {
      return ApiBadRequest("siteId is required for mode=assigned");
    }

    if (mode === "assigned") {
      const where: any = {
        siteEmployees: { some: { siteId } },
      };
      if (search) where.name = { contains: search };

      const result = await paginate({
        model: prisma.employee as any,
        where,
        orderBy: { name: "asc" },
        page,
        perPage,
        select: {
          id: true,
          name: true,
          department: { select: { id: true, department: true } },
          user: { select: { id: true, email: true } },
          siteEmployees: {
            where: { siteId },
            select: { id: true, assignedDate: true },
          },
        },
      });
      return Success(result);
    } else {
      // available: employees not assigned to this site
      if (Number.isNaN(siteId) || !siteId) {
        return ApiBadRequest("siteId is required for mode=available");
      }
      const where: any = {
        NOT: { siteEmployees: { some: { siteId } } },
      };
      if (search) where.name = { contains: search };

      const result = await paginate({
        model: prisma.employee as any,
        where,
        orderBy: { name: "asc" },
        page,
        perPage,
        select: {
          id: true,
          name: true,
          department: { select: { id: true, department: true } },
          user: { select: { id: true, email: true } },
        },
      });
      return Success(result);
    }
  } catch (e) {
    return ApiError("Failed to fetch employee assignments");
  }
}

// POST /api/employee-assignments  { siteId, employeeIds: number[] }
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    const siteId = Number(body?.siteId);
    const employeeIds: number[] = Array.isArray(body?.employeeIds)
      ? body.employeeIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : [];
    if (!siteId || Number.isNaN(siteId)) return ApiBadRequest("siteId is required");
    if (employeeIds.length === 0) return ApiBadRequest("employeeIds are required");

    const created = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let count = 0;
      for (const empId of employeeIds) {
        // skip if already assigned
        const exists = await tx.siteEmployee.findFirst({ where: { siteId, employeeId: empId }, select: { id: true } });
        if (exists) continue;
        await tx.siteEmployee.create({
          data: {
            siteId,
            employeeId: empId,
            assignedDate: now,
            assignedById: auth.user.id,
          },
        });
        await tx.siteEmployeeLog.create({
          data: {
            siteId,
            employeeId: empId,
            assignedDate: now,
            assignedById: auth.user.id,
          },
        });
        count++;
      }
      return count;
    });

    return Success({ count: created }, 201);
  } catch (e: any) {
    return ApiError(e?.message || "Failed to assign employees");
  }
}

// DELETE /api/employee-assignments  { siteId, employeeIds: number[] }
export async function DELETE(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    const siteId = Number(body?.siteId);
    const employeeIds: number[] = Array.isArray(body?.employeeIds)
      ? body.employeeIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : [];
    if (!siteId || Number.isNaN(siteId)) return ApiBadRequest("siteId is required");
    if (employeeIds.length === 0) return ApiBadRequest("employeeIds are required");

    const count = await prisma.$transaction(async (tx) => {
      // delete mapping and update logs
      await tx.siteEmployee.deleteMany({ where: { siteId, employeeId: { in: employeeIds } } });
      await tx.siteEmployeeLog.updateMany({
        where: { siteId, employeeId: { in: employeeIds }, unassignedDate: null },
        data: { unassignedDate: new Date(), unassignedById: auth.user.id },
      });
      return employeeIds.length;
    });

    return Success({ count });
  } catch (e) {
    return ApiError("Failed to unassign employees");
  }
}
