import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  workOrderId: z.coerce.number().min(1, "Work order is required"),
  billNo: z.string().min(1, "Bill No. is required"),
  billDate: z.string().transform((v) => new Date(v)),
  billAmount: z.coerce.number().min(0, "Bill amount must be non-negative"),
  paidAmount: z.coerce.number().min(0, "Paid amount must be non-negative").default(0),
  deductionTax: z.coerce.number().min(0).default(0),
  dueDate: z.string().transform((v) => new Date(v)),
  paymentDate: z.string().transform((v) => new Date(v)),
  paymentMode: z.string().min(1, "Payment mode is required"),
  chequeNo: z.string().nullable().optional(),
  chequeDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  utrNo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  status: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]),
});

// GET /api/work-order-bills?search=&page=1&perPage=10&sort=billDate&order=desc&workOrderId=&status=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
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
      ];
    }

    const workOrderId = Number(searchParams.get("workOrderId"));
    if (!Number.isNaN(workOrderId) && workOrderId > 0) where.workOrderId = workOrderId;

    const status = searchParams.get("status");
    if (status && ["PAID", "UNPAID", "PARTIALLY_PAID"].includes(status)) where.status = status;

    const sortableFields = new Set(["billDate", "createdAt", "billNo"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { billDate: "desc" };

    const result = await paginate({
      model: prisma.workOrderBill as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        workOrderId: true,
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
        deductionTax: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        workOrder: {
          select: { id: true, workOrderNo: true }
        }
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get work-order-bills error:", error);
    return ApiError("Failed to fetch work-order-bills");
  }
}

// POST /api/work-order-bills - Create new work order bill
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const computedDue = data.billAmount - data.paidAmount - data.deductionTax;

    const created = await prisma.workOrderBill.create({
      data: {
        workOrderId: data.workOrderId,
        billNo: data.billNo,
        billDate: data.billDate,
        billAmount: data.billAmount,
        paidAmount: data.paidAmount,
        deductionTax: data.deductionTax,
        dueAmount: computedDue,
        dueDate: data.dueDate,
        paymentDate: data.paymentDate,
        paymentMode: data.paymentMode,
        chequeNo: data.chequeNo ?? null,
        chequeDate: (data.chequeDate as any) ?? null,
        utrNo: data.utrNo ?? null,
        bankName: data.bankName ?? null,
        status: data.status,
      },
      select: {
        id: true,
        workOrderId: true,
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
        deductionTax: true,
        status: true,
        createdAt: true,
        workOrder: { select: { id: true, workOrderNo: true } },
      },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2003") {
      return ApiError("Invalid work order reference", 409);
    }
    console.error("Create work-order-bill error:", error);
    return ApiError("Failed to create work-order-bill");
  }
}
