import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const indentItemSchema = z.object({
  id: z.number().optional(), // For existing items
  itemId: z.number().min(1, "Item is required"),
  closingStock: z.number().min(0, "Closing stock must be non-negative"),
  unitId: z.number().min(1, "Unit is required"),
  remark: z.string().optional(),
  indentQty: z.number().min(0, "Indent quantity must be non-negative"),
  deliveryDate: z.string().transform((val) => new Date(val)),
});

const updateSchema = z.object({
  indentDate: z.string().transform((val) => new Date(val)).optional(),
  siteId: z.number().optional(),
  deliveryDate: z.string().transform((val) => new Date(val)).optional(),
  remarks: z.string().optional(),
  indentItems: z.array(indentItemSchema).optional(),
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
        deliveryDate: true,
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
            deliveryDate: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
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
      const { indentItems, ...indentData } = updateData;
      
      if (Object.keys(indentData).length > 0) {
        // Handle null values for optional foreign keys
        const processedData: any = {};
        for (const [key, value] of Object.entries(indentData)) {
          if (key === 'siteId') {
            processedData[key] = value || null;
          } else {
            processedData[key] = value;
          }
        }

        await tx.indent.update({
          where: { id },
          data: processedData,
        });
      }

      // Update indent items if provided
      if (indentItems && indentItems.length > 0) {
        // Delete existing items
        await tx.indentItem.deleteMany({
          where: { indentId: id },
        });

        // Create new items
        await tx.indentItem.createMany({
          data: indentItems.map(item => ({
            indentId: id,
            itemId: item.itemId!,
            closingStock: item.closingStock,
            unitId: item.unitId!,
            remark: item.remark || null,
            indentQty: item.indentQty,
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
          deliveryDate: true,
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
              deliveryDate: true,
            },
            orderBy: {
              id: 'asc',
            },
          },
        },
      });

      return updatedIndent;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Indent not found");
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
