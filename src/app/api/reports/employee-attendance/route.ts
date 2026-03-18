import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";

function parseYyyyMmDdToUtcDateOnly(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [yyyy, mm, dd] = v.split("-").map((x) => Number(x));
  if (!yyyy || !mm || !dd) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(dt);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(dt);
}

function formatWorkDuration(inTime: Date | null, outTime: Date | null): string {
  if (!inTime || !outTime) return "—";
  const diffMs = outTime.getTime() - inTime.getTime();
  const totalMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} minutes`;
  if (minutes <= 0) return `${hours} hours`;
  return `${hours} hours ${minutes} minutes`;
}

function decimalToStringOrNull(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (typeof v?.toString === "function") {
    const s = v.toString();
    return s ? s : null;
  }
  return null;
}

function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/api/uploads/")) return url.replace("/api/uploads/", "/uploads/");
  return url;
}

type Row = {
  date: string;
  site: { id: number; name: string; code: string | null };
  employee: { id: number; name: string };
  workHours: number;
  workDuration: string;
  workDay: 0 | 1;
  in: {
    time: string;
    imageUrl: string | null;
    latitude: string | null;
    longitude: string | null;
    accuracy: string | null;
    createdByName: string | null;
  } | null;
  out: {
    time: string;
    imageUrl: string | null;
    latitude: string | null;
    longitude: string | null;
    accuracy: string | null;
    createdByName: string | null;
  } | null;
};

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const sp = req.nextUrl.searchParams;
  const siteIdRaw = sp.get("siteId");
  const fromDateRaw = sp.get("fromDate");
  const toDateRaw = sp.get("toDate");

  const siteId = siteIdRaw ? Number(siteIdRaw) : NaN;
  if (!siteIdRaw || Number.isNaN(siteId) || siteId <= 0) {
    return NextResponse.json({ message: "siteId is required" }, { status: 400 });
  }

  if (!fromDateRaw || !toDateRaw) {
    return NextResponse.json(
      { message: "fromDate and toDate are required" },
      { status: 400 }
    );
  }

  const from = parseYyyyMmDdToUtcDateOnly(fromDateRaw);
  const to = parseYyyyMmDdToUtcDateOnly(toDateRaw);
  if (!from || !to) {
    return NextResponse.json(
      { message: "Invalid fromDate/toDate. Expected YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (from.getTime() > to.getTime()) {
    return NextResponse.json(
      { message: "fromDate must be less than or equal to toDate" },
      { status: 400 }
    );
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, site: true, siteCode: true },
  });

  if (!site) {
    return NextResponse.json({ message: "Site not found" }, { status: 404 });
  }

  const rows = await prisma.employeeAttendance.findMany({
    where: {
      siteId,
      date: { gte: from, lte: to },
      type: { in: ["IN", "OUT"] },
    },
    include: {
      employee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { employeeId: "asc" }, { type: "asc" }],
  });

  const byKey = new Map<string, { inRow: (typeof rows)[number] | null; outRow: (typeof rows)[number] | null }>();
  for (const r of rows) {
    const key = `${r.employeeId}:${r.date.toISOString().slice(0, 10)}`;
    const entry = byKey.get(key) || { inRow: null, outRow: null };
    if (r.type === "IN") entry.inRow = r;
    if (r.type === "OUT") entry.outRow = r;
    byKey.set(key, entry);
  }

  const result: Row[] = [];
  for (const [key, entry] of byKey.entries()) {
    const base = entry.inRow || entry.outRow;
    if (!base) continue;

    const inTime = entry.inRow?.time ? new Date(entry.inRow.time) : null;
    const outTime = entry.outRow?.time ? new Date(entry.outRow.time) : null;

    const workDay: 0 | 1 = inTime && outTime ? 1 : 0;
    const workHours =
      inTime && outTime
        ? Math.max(0, (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60))
        : 0;
    const workDuration = formatWorkDuration(inTime, outTime);

    result.push({
      date: formatDate(base.date),
      site: {
        id: site.id,
        name: site.site,
        code: site.siteCode ?? null,
      },
      employee: {
        id: base.employee.id,
        name: base.employee.name,
      },
      workHours: Number(workHours.toFixed(2)),
      workDuration,
      workDay,
      in: entry.inRow
        ? {
            time: formatTime(entry.inRow.time),
            imageUrl: normalizeImageUrl(entry.inRow.imageUrl),
            latitude: decimalToStringOrNull(entry.inRow.latitude),
            longitude: decimalToStringOrNull(entry.inRow.longitude),
            accuracy: decimalToStringOrNull((entry.inRow as any).accuracy),
            createdByName: entry.inRow.createdBy?.name ?? null,
          }
        : null,
      out: entry.outRow
        ? {
            time: formatTime(entry.outRow.time),
            imageUrl: normalizeImageUrl(entry.outRow.imageUrl),
            latitude: decimalToStringOrNull(entry.outRow.latitude),
            longitude: decimalToStringOrNull(entry.outRow.longitude),
            accuracy: decimalToStringOrNull((entry.outRow as any).accuracy),
            createdByName: entry.outRow.createdBy?.name ?? null,
          }
        : null,
    });
  }

  return NextResponse.json(
    {
      data: result,
      meta: {
        siteId,
        fromDate: fromDateRaw,
        toDate: toDateRaw,
        total: result.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
