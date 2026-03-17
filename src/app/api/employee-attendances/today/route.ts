import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const employee = await prisma.employee.findFirst({
      where: { userId: auth.user.id },
      select: { id: true },
    });

    if (!employee) {
      return Success({
        data: {
          hasEmployee: false,
          in: null,
          out: null,
        },
      });
    }

    const today = toDateOnly(new Date());

    const rows = await prisma.employeeAttendance.findMany({
      where: {
        employeeId: employee.id,
        date: today,
        type: { in: ["IN", "OUT"] },
      },
      select: {
        type: true,
        time: true,
      },
    });

    const inRow = rows.find((r) => r.type === "IN") ?? null;
    const outRow = rows.find((r) => r.type === "OUT") ?? null;

    return Success({
      data: {
        hasEmployee: true,
        in: inRow ? { time: inRow.time } : null,
        out: outRow ? { time: outRow.time } : null,
      },
    });
  } catch (e) {
    console.error("Employee attendance today error:", e);
    return ApiError("Failed to fetch today attendance");
  }
}
