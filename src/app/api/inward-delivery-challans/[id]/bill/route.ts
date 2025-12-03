import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess, guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { z } from "zod";

// POST /api/inward-delivery-challans/[id]/bill
// Sets bill info on an existing inward delivery challan
const billSchema = z.object({
  billNo: z.string().min(1).max(100),
  billDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid bill date" }),
  billAmount: z.number().min(0),
  dueDays: z.number().int().min(0).default(0),
  dueDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid due date" })
    .optional()
    .nullable(),
  status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Explicitly enforce edit inward bill permission
  const auth = await guardApiPermissions(req, [PERMISSIONS.EDIT_INWARD_BILL]);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid inward delivery challan ID");

    const body = await req.json();
    const parsed = billSchema.parse(body);

    const challan = await prisma.inwardDeliveryChallan.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!challan) return NotFound("Inward delivery challan not found");

    const billDate = new Date(parsed.billDate);
    const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;

    // Need current totalPaidAmount to compute dueAmount
    const current = await prisma.inwardDeliveryChallan.findUnique({
      where: { id },
      select: { totalPaidAmount: true },
    });
    const totalPaid = Number(current?.totalPaidAmount || 0);
    const dueAmount = Math.max(
      0,
      Number((parsed.billAmount - totalPaid).toFixed(2))
    );

    const updated = await prisma.inwardDeliveryChallan.update({
      where: { id },
      data: {
        billNo: parsed.billNo,
        billDate: billDate,
        billAmount: parsed.billAmount,
        dueDays: parsed.dueDays,
        dueDate: dueDate,
        status: parsed.status as any,
        dueAmount,
        updatedBy: { connect: { id: (auth as any).user?.id as number } },
      } as any,
      select: {
        id: true,
        billNo: true,
        billDate: true,
        billAmount: true,
        dueDays: true,
        dueDate: true,
        status: true,
        updatedAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as any).code === "P2025"
    ) {
      return NotFound("Inward delivery challan not found");
    }
    console.error("Set challan bill error:", error);
    return ApiError("Failed to set challan bill");
  }
}
