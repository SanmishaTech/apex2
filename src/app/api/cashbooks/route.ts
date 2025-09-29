import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  voucherDate: z.string().min(1, "Voucher date is required"),
  siteId: z.number().nullable().optional(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z.array(z.object({
    cashbookHeadId: z.number().min(1, "Cashbook head is required"),
    description: z.string().nullable().optional(),
    received: z.number().nullable().optional(),
    expense: z.number().nullable().optional(),
  })).min(1, "At least one cashbook detail is required"),
});

// GET /api/cashbooks?search=&page=1&perPage=10&sort=voucherDate&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "voucherDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { site: { site: { contains: search } } },
        { boq: { boqNo: { contains: search } } },
      ];
    }

    // Allow listed sortable fields only
    const sortableFields = new Set(["voucherNo", "voucherDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { voucherDate: "desc" };

    const result = await paginate({
      model: prisma.cashbook,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        voucherNo: true,
        voucherDate: true,
        attachVoucherCopyUrl: true,
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get cashbooks error:", error);
    return Error("Failed to fetch cashbooks");
  }
}

// POST /api/cashbooks (create cashbook)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { voucherDate, siteId, boqId, attachVoucherCopyUrl, cashbookDetails } = createSchema.parse(body);
    
    // Generate voucher number
    const lastCashbook = await prisma.cashbook.findFirst({
      where: { voucherNo: { not: null } },
      orderBy: { voucherNo: "desc" },
      select: { voucherNo: true }
    });
    
    let nextNumber = 1;
    if (lastCashbook?.voucherNo) {
      const match = lastCashbook.voucherNo.match(/VCH-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const voucherNo = `VCH-${nextNumber.toString().padStart(5, '0')}`;
    
    const created = await prisma.cashbook.create({
      data: {
        voucherNo,
        voucherDate: new Date(voucherDate),
        siteId,
        boqId,
        attachVoucherCopyUrl,
        cashbookDetails: {
          create: cashbookDetails.map(detail => ({
            cashbookHeadId: detail.cashbookHeadId,
            description: detail.description,
            received: detail.received ? parseFloat(detail.received.toString()) : null,
            expense: detail.expense ? parseFloat(detail.expense.toString()) : null,
          }))
        }
      },
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        cashbookDetails: {
          include: {
            cashbookHead: { select: { id: true, cashbookHeadName: true } }
          }
        }
      },
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create cashbook error:", error);
    return Error("Failed to create cashbook");
  }
}
