import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiPermissions } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import { PERMISSIONS } from "@/config/roles";

const createSchema = z.object({
  subContractorWorkOrderId: z.coerce.number().min(1, "Sub contractor work order is required"),
  billNo: z.string().min(1, "Bill No. is required"),
  billDate: z.string().transform((v) => new Date(v)),
  billAmount: z.coerce.number().min(0, "Bill amount must be non-negative"),
  paidAmount: z.coerce.number().min(0, "Paid amount must be non-negative").default(0),
  deductionTax: z.coerce.number().min(0).default(0),
  dueDate: z.string().transform((v) => new Date(v)),
  paymentDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  paymentMode: z.string().min(1, "Payment mode is required"),
  chequeNo: z.string().nullable().optional(),
  chequeDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  utrNo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  rtgsDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  neftDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  transactionNo: z.string().nullable().optional(),
  transactionDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  status: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]),
});

// GET /api/sub-contractor-work-order-bills?search=&page=1&perPage=10&sort=billDate&order=desc&subContractorWorkOrderId=&status=
export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SUB_CONTRACTOR_WORK_ORDER_BILLS]);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "billDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { billNo: { contains: search } },
        { paymentMode: { contains: search } },
        { utrNo: { contains: search } },
        { bankName: { contains: search } },
        { transactionNo: { contains: search } },
      ];
    }

    const scwoId = Number(searchParams.get("subContractorWorkOrderId"));
    if (!Number.isNaN(scwoId) && scwoId > 0) where.subContractorWorkOrderId = scwoId;

    const status = searchParams.get("status");
    if (status && ["PAID", "UNPAID", "PARTIALLY_PAID"].includes(status)) where.status = status;

    const sortableFields = new Set(["billDate", "createdAt", "billNo"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { billDate: "desc" };

    const result = await paginate({
      model: prisma.subContractorWorkOrderBill as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        subContractorWorkOrderId: true,
        billNo: true,
        billDate: true,
        billAmount: true,
        paidAmount: true,
        dueAmount: true,
        dueDate: true,
        paymentDate: true,
        paymentMode: true,
        chequeNo: true,
        chequeDate: true,
        utrNo: true,
        bankName: true,
        rtgsDate: true,
        neftDate: true,
        transactionNo: true,
        transactionDate: true,
        deductionTax: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        subContractorWorkOrder: {
          select: { id: true, workOrderNo: true }
        }
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get sub-contractor-work-order-bills error:", error);
    return ApiError("Failed to fetch sub-contractor-work-order-bills");
  }
}

// POST /api/sub-contractor-work-order-bills - Create new bill
export async function POST(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.CREATE_SUB_CONTRACTOR_WORK_ORDER_BILLS]);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const computedDue = data.billAmount - (data.paidAmount ?? 0) - (data.deductionTax ?? 0);

    const created = await prisma.subContractorWorkOrderBill.create({
      // cast to any to avoid strict Prisma TypeScript mismatch for optional relation fields (createdById/updatedById)
      data: {
        // ensure required audit fields are set from the authenticated user
        createdById: auth.user.id,
        updatedById: auth.user.id,
        subContractorWorkOrderId: data.subContractorWorkOrderId,
        billNo: data.billNo,
        billDate: data.billDate,
        billAmount: data.billAmount,
        paidAmount: data.paidAmount ?? 0,
        deductionTax: data.deductionTax ?? 0,
        dueAmount: computedDue,
        dueDate: data.dueDate,
        paymentDate: (data.paymentDate as any) ?? null,
  // cast paymentMode to any to satisfy Prisma enum typing
  paymentMode: data.paymentMode as any,
        chequeNo: data.chequeNo ?? null,
        chequeDate: (data.chequeDate as any) ?? null,
        utrNo: data.utrNo ?? null,
        bankName: data.bankName ?? null,
        rtgsDate: (data.rtgsDate as any) ?? null,
        neftDate: (data.neftDate as any) ?? null,
        transactionNo: data.transactionNo ?? null,
        transactionDate: (data.transactionDate as any) ?? null,
        status: data.status,
  } as any,
      select: {
        id: true,
        subContractorWorkOrderId: true,
        billNo: true,
        billDate: true,
        billAmount: true,
        paidAmount: true,
        dueAmount: true,
        dueDate: true,
        paymentDate: true,
        paymentMode: true,
        chequeNo: true,
        chequeDate: true,
        utrNo: true,
        bankName: true,
        rtgsDate: true,
        neftDate: true,
        transactionNo: true,
        transactionDate: true,
        deductionTax: true,
        status: true,
        createdAt: true,
        subContractorWorkOrder: { select: { id: true, workOrderNo: true } },
      },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2003") {
      return ApiError("Invalid sub-contractor work order reference", 409);
    }
    console.error("Create sub-contractor-work-order-bill error:", error);
    return ApiError("Failed to create sub-contractor-work-order-bill");
  }
}
