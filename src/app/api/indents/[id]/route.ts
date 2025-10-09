import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const indentItemSchema = z.object({
  id: z.number().optional(), // For existing items
  itemId: z.coerce.number().min(1, "Item is required"),
  // MySQL DECIMAL(12,2) max is 9,999,999,999.99
  closingStock: z
    .coerce
    .number()
    .min(0, "Closing stock must be non-negative")
    .max(9999999999.99, "Closing stock must be <= 9,999,999,999.99"),
  unitId: z.coerce.number().min(1, "Unit is required"),
  remark: z.string().optional(),
  indentQty: z
    .coerce
    .number()
    .min(0, "Indent quantity must be non-negative")
    .max(9999999999.99, "Indent quantity must be <= 9,999,999,999.99"),
  approvedQty: z
    .coerce
    .number()
    .min(0, "Approved quantity must be non-negative")
    .max(9999999999.99, "Approved quantity must be <= 9,999,999,999.99")
    .optional(),
  deliveryDate: z.string().transform((val) => new Date(val)),
});

const updateSchema = z.object({
  indentDate: z.string().transform((val) => new Date(val)).optional(),
  siteId: z.number().optional(),
  remarks: z.string().optional(),
  indentItems: z.array(indentItemSchema).optional(),
  statusAction: z.enum(['approve1', 'approve2', 'complete', 'suspend', 'unsuspend']).optional(),
});

// GET /api/indents/[id] - Get single indent
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid indent ID");

    const indent = await prisma.indent.findUnique({
      where: { id },
      select: {
        id: true,
        indentNo: true,
        indentDate: true,
        siteId: true,
        approvalStatus: true,
        suspended: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        indentItems: {
          select: {
            id: true,
            itemId: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                item: true,
              },
            },
            closingStock: true,
            unitId: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              },
            },
            remark: true,
            indentQty: true,
            approvedQty: true,
            deliveryDate: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      } as any,
    });

    if (!indent) return NotFound("Indent not found");
    return Success(indent);
  } catch (error) {
    console.error("Get indent error:", error);
    return ApiError("Failed to fetch indent");
  }
}

// PATCH /api/indents/[id] - Update indent
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid indent ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update indent header
      const { indentItems, statusAction, ...indentData } = updateData as any;

      // Update basic fields if provided
      if (Object.keys(indentData).length > 0) {
        await tx.indent.update({
          where: { id },
          data: indentData,
        });
      }

      // Handle approval workflow actions
      if (statusAction) {
        const current: any = await tx.indent.findUnique({
          where: { id },
          select: { approvalStatus: true } as any,
        });
        if (!current) {
          throw new Error('BAD_REQUEST: Indent not found');
        }
        const now = new Date();
        if (statusAction === 'approve1') {
          if (current.approvalStatus !== 'DRAFT') {
            throw new Error('BAD_REQUEST: Only DRAFT can be approved (level 1)');
          }
          await tx.indent.update({
            where: { id },
            data: { approvalStatus: 'APPROVED_1', approved1ById: auth.user.id, approved1At: now } as any,
          });
        } else if (statusAction === 'approve2') {
          if (current.approvalStatus !== 'APPROVED_1') {
            throw new Error('BAD_REQUEST: Only level 1 approved can be approved (level 2)');
          }
          await tx.indent.update({
            where: { id },
            data: { approvalStatus: 'APPROVED_2', approved2ById: auth.user.id, approved2At: now } as any,
          });
        } else if (statusAction === 'complete') {
          if (current.approvalStatus !== 'APPROVED_2') {
            throw new Error('BAD_REQUEST: Only level 2 approved can be completed');
          }
          await tx.indent.update({
            where: { id },
            data: { approvalStatus: 'COMPLETED', completedById: auth.user.id, completedAt: now } as any,
          });
        } else if (statusAction === 'suspend') {
          if (current.approvalStatus === 'COMPLETED') {
            throw new Error('BAD_REQUEST: Completed indent cannot be suspended');
          }
          await tx.indent.update({
            where: { id },
            data: { suspended: true, suspendedById: auth.user.id, suspendedAt: now },
          });
        } else if (statusAction === 'unsuspend') {
          await tx.indent.update({
            where: { id },
            data: { suspended: false },
          });
        }
      }

      // If updating items during an approval-type action (non-suspend), ensure approvedQty is provided
      if (statusAction && statusAction !== 'suspend' && Array.isArray(indentItems)) {
        const missing = indentItems.some((it: any) => it.approvedQty == null || Number.isNaN(it.approvedQty));
        if (missing) {
          throw new Error('BAD_REQUEST: Approved quantity is required for all items');
        }
      }

      if (indentItems && indentItems.length > 0) {
        // Delete existing items
        await tx.indentItem.deleteMany({
          where: { indentId: id },
        });

        // Create new items
        await tx.indentItem.createMany({
          data: indentItems.map((item: any) => ({
            indentId: id,
            itemId: item.itemId!,
            closingStock: item.closingStock,
            unitId: item.unitId!,
            remark: item.remark || null,
            indentQty: item.indentQty,
            approvedQty: item.approvedQty ?? null,
            deliveryDate: item.deliveryDate,
          })),
        });
      }

      // Fetch updated indent with items
      const updatedIndent = await tx.indent.findUnique({
        where: { id },
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          siteId: true,
          approvalStatus: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          indentItems: {
            select: {
              id: true,
              item: true,
              closingStock: true,
              unit: true,
              remark: true,
              indentQty: true,
              approvedQty: true,
              deliveryDate: true,
            },
            orderBy: {
              id: 'asc',
            },
          },
        } as any,
      });

      return updatedIndent;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Indent not found");
    if (typeof error?.message === 'string' && error.message.startsWith('BAD_REQUEST:')) {
      return BadRequest(error.message.replace('BAD_REQUEST: ', ''));
    }
    console.error("Update indent error:", error);
    return ApiError("Failed to update indent");
  }
}

// DELETE /api/indents/[id] - Delete indent
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid indent ID");

    // Delete indent (cascade will handle items)
    await prisma.indent.delete({ where: { id } });

    return Success({ message: "Indent deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Indent not found");
    console.error("Delete indent error:", error);
    return ApiError("Failed to delete indent");
  }
}
