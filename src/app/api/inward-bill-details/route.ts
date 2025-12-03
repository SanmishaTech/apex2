import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess, guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { z } from "zod";

// POST /api/inward-bill-details - create a new inward bill detail entry
const createDetailSchema = z.object({
  inwardDeliveryChallanId: z.number().int().positive(),
  paymentDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid payment date" }),
  paymentMode: z.enum(["CASH", "UPI", "CHEQUE", "RTGS", "NEFT", "NET_BANKING"]),
  chequeNo: z.string().max(30).optional().nullable(),
  chequeDate: z
    .string()
    .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Invalid cheque date" })
    .optional()
    .nullable(),
  utrNo: z.string().max(50).optional().nullable(),
  rtgsDate: z
    .string()
    .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Invalid RTGS date" })
    .optional()
    .nullable(),
  neftDate: z
    .string()
    .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Invalid NEFT date" })
    .optional()
    .nullable(),
  transactionNo: z.string().max(30).optional().nullable(),
  transactionDate: z
    .string()
    .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Invalid transaction date" })
    .optional()
    .nullable(),
  bankName: z.string().max(50).optional().nullable(),
  paidAmount: z.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.ADD_INWARD_BILL_PAYMENT]);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createDetailSchema.parse(body);

    const challan = await prisma.inwardDeliveryChallan.findUnique({
      where: { id: parsed.inwardDeliveryChallanId },
      select: { id: true, billAmount: true, totalPaidAmount: true },
    });
    if (!challan) return NotFound("Inward delivery challan not found");

    const paymentDate = new Date(parsed.paymentDate);
    const chequeDate = parsed.chequeDate ? new Date(parsed.chequeDate) : null;
    const rtgsDate = parsed.rtgsDate ? new Date(parsed.rtgsDate) : null;
    const neftDate = parsed.neftDate ? new Date(parsed.neftDate) : null;
    const transactionDate = parsed.transactionDate
      ? new Date(parsed.transactionDate)
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.inwardBillDetail.create({
        data: {
          inwardDeliveryChallanId: parsed.inwardDeliveryChallanId,
          paymentDate,
          paymentMode: parsed.paymentMode,
          chequeNo: parsed.chequeNo ?? null,
          chequeDate,
          utrNo: parsed.utrNo ?? null,
          rtgsDate,
          neftDate,
          transactionNo: parsed.transactionNo ?? null,
          transactionDate,
          bankName: parsed.bankName ?? null,
          paidAmount: parsed.paidAmount,
        },
        select: {
          id: true,
          inwardDeliveryChallanId: true,
          paymentDate: true,
          paymentMode: true,
          chequeNo: true,
          chequeDate: true,
          utrNo: true,
          rtgsDate: true,
          neftDate: true,
          transactionNo: true,
          transactionDate: true,
          bankName: true,
          paidAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const newTotal = Number(challan.totalPaidAmount || 0) + Number(parsed.paidAmount || 0);
      const billAmount = Number(challan.billAmount || 0);
      const dueAmount = Math.max(0, Number((billAmount - newTotal).toFixed(2)));

      await tx.inwardDeliveryChallan.update({
        where: { id: challan.id },
        data: {
          totalPaidAmount: newTotal,
          dueAmount,
          updatedBy: { connect: { id: (auth as any).user?.id as number } },
        } as any,
      });

      return created;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    console.error("Create inward bill detail error:", error);
    return ApiError("Failed to create inward bill detail");
  }

}

// GET /api/inward-bill-details?challanId=123 - list all payments for a challan
export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.ADD_INWARD_BILL_PAYMENT]);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const challanId = Number(searchParams.get("challanId"));
    if (!Number.isFinite(challanId) || challanId <= 0)
      return BadRequest("Invalid challanId");

    const rows = await prisma.inwardBillDetail.findMany({
      where: { inwardDeliveryChallanId: challanId },
      orderBy: { id: "desc" },
      select: {
        id: true,
        // inwardDeliveryChallanId: excluded as per requirement
        paymentDate: true,
        paymentMode: true,
        chequeNo: true,
        chequeDate: true,
        utrNo: true,
        rtgsDate: true,
        neftDate: true,
        transactionNo: true,
        transactionDate: true,
        bankName: true,
        paidAmount: true,
        createdAt: true,
        // updatedAt excluded as per requirement
      },
    });
    return Success(rows);
  } catch (error: any) {
    console.error("List inward bill details error:", error);
    return ApiError("Failed to fetch inward bill details");
  }
}
