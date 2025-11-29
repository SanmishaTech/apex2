import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  itemId: z.number().int().positive("Item ID is required").optional(),
  budgetQty: z.number().positive("Budget quantity must be positive").optional(),
  budgetRate: z.number().positive("Budget rate must be positive").optional(),
  purchaseRate: z.number().positive("Purchase rate must be positive").optional(),
  qty50Alert: z.boolean().optional(),
  value50Alert: z.boolean().optional(),
  qty75Alert: z.boolean().optional(),
  value75Alert: z.boolean().optional(),
});

// GET /api/site-budgets/[id] - Get single site budget
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid site budget ID", 400);

    const siteBudget = await prisma.siteBudget.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        itemId: true,
        budgetQty: true,
        budgetRate: true,
        purchaseRate: true,
        budgetValue: true,
        orderedQty: true,
        avgRate: true,
        orderedValue: true,
        qty50Alert: true,
        value50Alert: true,
        qty75Alert: true,
        value75Alert: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          }
        },
        item: {
          select: {
            id: true,
            item: true,
            itemCode: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              }
            }
          }
        }
      }
    });

    if (!siteBudget) return NotFound('Site budget not found');
    return Success(siteBudget);
  } catch (error) {
    console.error("Get site budget error:", error);
    return Error("Failed to fetch site budget");
  }
}

// PATCH /api/site-budgets/[id] - Update site budget
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid site budget ID", 400);

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return Error("No valid fields to update", 400);
    }

    // Get current data to calculate new values
    const current = await prisma.siteBudget.findUnique({
      where: { id },
      select: { siteId: true, itemId: true, budgetQty: true, budgetRate: true, orderedQty: true, avgRate: true }
    });

    if (!current) return NotFound('Site budget not found');

    // If itemId is changing, ensure the (siteId, itemId) pair remains unique
    if (updateData.itemId !== undefined && updateData.itemId !== current.itemId) {
      const duplicate = await prisma.siteBudget.findFirst({
        where: { siteId: current.siteId, itemId: updateData.itemId }
      });
      if (duplicate) {
        return BadRequest("A budget entry for this item already exists for the selected site.");
      }
    }

    // Calculate new values based on what's being updated
    const newBudgetQty = updateData.budgetQty ?? current.budgetQty;
    const newBudgetRate = updateData.budgetRate ?? current.budgetRate;
    // orderedQty and avgRate are read-only here; use current values
    const budgetValue = Number(newBudgetQty) * Number(newBudgetRate);
    const orderedValue = Number(current.orderedQty) * Number(current.avgRate);

    const updated = await prisma.siteBudget.update({
      where: { id },
      data: {
        ...updateData,
        budgetValue,
        orderedValue,
      },
      select: {
        id: true,
        siteId: true,
        itemId: true,
        budgetQty: true,
        budgetRate: true,
        purchaseRate: true,
        budgetValue: true,
        orderedQty: true,
        avgRate: true,
        orderedValue: true,
        qty50Alert: true,
        value50Alert: true,
        qty75Alert: true,
        value75Alert: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          }
        },
        item: {
          select: {
            id: true,
            item: true,
            itemCode: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              }
            }
          }
        }
      }
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Site budget not found');
    if (error.code === 'P2002') {
      return BadRequest("A budget entry for this item already exists for the selected site.");
    }
    console.error("Update site budget error:", error);
    return Error("Failed to update site budget");
  }
}

// DELETE /api/site-budgets/[id] - Delete site budget
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid site budget ID", 400);

    await prisma.siteBudget.delete({
      where: { id }
    });

    return Success({ message: "Site budget deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2025') return NotFound('Site budget not found');
    console.error("Delete site budget error:", error);
    return Error("Failed to delete site budget");
  }
}
