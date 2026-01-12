import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

 function startOfDay(d: Date) {
   return new Date(d.getFullYear(), d.getMonth(), d.getDate());
 }

 function addDays(d: Date, days: number) {
   const next = new Date(d);
   next.setDate(next.getDate() + days);
   return next;
 }

// GET /api/cashbooks/last-balance?siteId=..&boqId=..&cashbookHeadId=..
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const siteIdStr = searchParams.get("siteId");
  const boqIdStr = searchParams.get("boqId");
  const cashbookHeadIdStr = searchParams.get("cashbookHeadId");
  const voucherDateStr = searchParams.get("voucherDate");

  if (!siteIdStr || !cashbookHeadIdStr) {
    return BadRequest("siteId and cashbookHeadId are required");
  }

  const siteId = Number(siteIdStr);
  const cashbookHeadId = Number(cashbookHeadIdStr);
  const boqId = boqIdStr != null && boqIdStr !== "" ? Number(boqIdStr) : undefined;

  const voucherDate =
    voucherDateStr && voucherDateStr.trim() !== "" && !Number.isNaN(Date.parse(voucherDateStr))
      ? startOfDay(new Date(voucherDateStr))
      : undefined;

  const voucherDateExclusiveEnd =
    voucherDate !== undefined ? addDays(voucherDate, 1) : undefined;

  if (!Number.isFinite(siteId) || siteId <= 0) return BadRequest("Invalid siteId");
  if (!Number.isFinite(cashbookHeadId) || cashbookHeadId <= 0) return BadRequest("Invalid cashbookHeadId");
  if (boqIdStr != null && boqIdStr !== "" && (!Number.isFinite(boqId!) || (boqId as number) <= 0)) {
    return BadRequest("Invalid boqId");
  }

  try {
    const lastDetail = await prisma.cashbookDetail.findFirst({
      where: {
        cashbookHeadId,
        cashbook: {
          siteId,
          ...(boqId !== undefined ? { boqId } : {}),
          ...(voucherDateExclusiveEnd !== undefined
            ? { voucherDate: { lt: voucherDateExclusiveEnd } }
            : {}),
        },
      },
      orderBy: [
        { cashbook: { voucherDate: "desc" } },
        { cashbook: { id: "desc" } },
        { id: "desc" },
      ],
      select: {
        id: true,
        closingBalance: true,
        cashbookId: true,
      },
    });

    return Success({
      closingBalance: lastDetail?.closingBalance ?? null,
      id: lastDetail?.id ?? null,
      cashbookId: lastDetail?.cashbookId ?? null,
    });
  } catch (error) {
    console.error("Last balance lookup failed:", error);
    return ApiError("Failed to fetch last balance");
  }
}
