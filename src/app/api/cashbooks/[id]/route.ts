import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  voucherDate: z.string().optional(),
  siteId: z.number().nullable().optional(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z.array(z.object({
    id: z.number().optional(), // For existing details
    cashbookHeadId: z.number().min(1, "Cashbook head is required"),
    description: z.string().nullable().optional(),
    received: z.number().nullable().optional(),
    expense: z.number().nullable().optional(),
  })).optional(),
});

// GET /api/cashbooks/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const cashbook = await prisma.cashbook.findUnique({
      where: { id },
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

    if (!cashbook) return NotFound('Cashbook not found');
    return Success(cashbook);
  } catch (error) {
    console.error("Get cashbook error:", error);
    return Error("Failed to fetch cashbook");
  }
}

// PATCH /api/cashbooks/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const { voucherDate, siteId, boqId, attachVoucherCopyUrl, cashbookDetails } = updateSchema.parse(body);

    const updateData: any = {};
    if (voucherDate) updateData.voucherDate = new Date(voucherDate);
    if (siteId !== undefined) updateData.siteId = siteId;
    if (boqId !== undefined) updateData.boqId = boqId;
    if (attachVoucherCopyUrl !== undefined) updateData.attachVoucherCopyUrl = attachVoucherCopyUrl;

    // Handle cashbook details update
    if (cashbookDetails) {
      // Delete existing details first
      await prisma.cashbookDetail.deleteMany({
        where: { cashbookId: id }
      });

      // Create new details
      updateData.cashbookDetails = {
        create: cashbookDetails.map(detail => ({
          cashbookHeadId: detail.cashbookHeadId,
          description: detail.description,
          received: detail.received ? parseFloat(detail.received.toString()) : null,
          expense: detail.expense ? parseFloat(detail.expense.toString()) : null,
        }))
      };
    }

    const updated = await prisma.cashbook.update({
      where: { id },
      data: updateData,
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

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if ((error as any).code === 'P2025') return NotFound('Cashbook not found');
    console.error("Update cashbook error:", error);
    return Error("Failed to update cashbook");
  }
}

// DELETE /api/cashbooks/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    await prisma.cashbook.delete({
      where: { id },
    });

    return Success({ message: 'Cashbook deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') return NotFound('Cashbook not found');
    console.error("Delete cashbook error:", error);
    return Error("Failed to delete cashbook");
  }
}
