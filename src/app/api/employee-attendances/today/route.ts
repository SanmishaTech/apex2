import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateOnlyIST(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const y = Number(parts.year);
  const m = Number(parts.month);
  const day = Number(parts.day);
  return new Date(Date.UTC(y, m - 1, day));
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

    const today = toDateOnlyIST(new Date());

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
