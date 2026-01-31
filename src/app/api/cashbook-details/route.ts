import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  Forbidden,
} from "@/lib/api-response";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";

function startOfDayUtc(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function parseHeadIds(raw: string | null) {
  if (!raw) return [] as number[];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_CASHBOOKS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const siteIdStr = sp.get("siteId");
  const boqIdStr = sp.get("boqId");
  const fromDateStr = sp.get("fromDate");
  const toDateStr = sp.get("toDate");
  const cashbookHeadIdsStr = sp.get("cashbookHeadIds");

  if (!siteIdStr || Number.isNaN(Number(siteIdStr))) {
    return BadRequest("siteId is required");
  }
  if (!boqIdStr || Number.isNaN(Number(boqIdStr))) {
    return BadRequest("boqId is required");
  }
  if (!fromDateStr || Number.isNaN(Date.parse(fromDateStr))) {
    return BadRequest("fromDate is required (YYYY-MM-DD)");
  }
  if (!toDateStr || Number.isNaN(Date.parse(toDateStr))) {
    return BadRequest("toDate is required (YYYY-MM-DD)");
  }

  const siteId = Number(siteIdStr);
  const boqId = Number(boqIdStr);
  const fromDate = startOfDayUtc(fromDateStr);
  const toDateExclusive = addDaysUtc(startOfDayUtc(toDateStr), 1);
  const cashbookHeadIds = parseHeadIds(cashbookHeadIdsStr);

  if (auth.user.role !== ROLES.ADMIN) {
    const employee = await prisma.employee.findFirst({
      where: { userId: auth.user.id },
      select: { siteEmployees: { select: { siteId: true } } },
    });
    const assignedSiteIds: number[] = (employee?.siteEmployees || [])
      .map((s) => s.siteId)
      .filter((v): v is number => typeof v === "number");
    if (!assignedSiteIds.includes(siteId)) {
      return Forbidden("Site is not assigned to current user");
    }
  }

  try {
    const rows = await prisma.cashbookDetail.findMany({
      where: {
        ...(cashbookHeadIds.length > 0 ? { cashbookHeadId: { in: cashbookHeadIds } } : {}),
        cashbook: {
          siteId,
          boqId,
          voucherDate: { gte: fromDate, lt: toDateExclusive },
        },
      },
      orderBy: [
        { cashbook: { voucherDate: "asc" } },
        { cashbook: { id: "asc" } },
        { id: "asc" },
      ],
      select: {
        id: true,
        description: true,
        openingBalance: true,
        closingBalance: true,
        amountReceived: true,
        amountPaid: true,
        documentUrl: true,
        cashbookHead: { select: { id: true, cashbookHeadName: true } },
        cashbook: {
          select: {
            id: true,
            voucherNo: true,
            voucherDate: true,
          },
        },
      },
    });

    const data = rows.map((r) => ({
      id: r.id,
      voucherDate: r.cashbook.voucherDate,
      voucherNo: r.cashbook.voucherNo,
      cashbookHeadId: r.cashbookHead?.id ?? null,
      cashbookHeadName: r.cashbookHead?.cashbookHeadName ?? "-",
      description: r.description ?? "",
      supportingBill: Boolean(r.documentUrl),
      openingBalance: r.openingBalance,
      amountReceived: r.amountReceived,
      amountPaid: r.amountPaid,
      closingBalance: r.closingBalance,
      documentUrl: r.documentUrl,
      cashbookId: r.cashbook.id,
    }));

    return Success({ data });
  } catch (error) {
    console.error("Cashbook details list error:", error);
    return ApiError("Failed to fetch cashbook details");
  }
}
