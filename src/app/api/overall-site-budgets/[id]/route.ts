import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { z } from "zod";

// GET /api/overall-site-budgets/[id] - Get single overall site budget
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid overall site budget ID", 400);

    const overallSiteBudget = await (prisma as any).overallSiteBudget.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        createdAt: true,
        updatedAt: true,
        overallSiteBudgetDetails: {
          select: {
            id: true,
            overallSiteBudgetId: true,
            BoqItemId: true,
            boqItem: {
              select: {
                id: true,
                activityId: true,
                clientSrNo: true,
                item: true,
                unit: { select: { unitName: true } },
                qty: true,
                rate: true,
                amount: true,
                isGroup: true,
              },
            },
            overallSiteBudgetItems: {
              select: {
                id: true,
                overallSiteBudgetDetailId: true,
                itemId: true,
                item: {
                  select: {
                    id: true,
                    item: true,
                    itemCode: true,
                    unit: { select: { unitName: true } },
                  },
                },
                budgetQty: true,
                budgetRate: true,
                purchaseRate: true,
                budgetValue: true,
              },
              orderBy: { itemId: "asc" },
            },
          },
          orderBy: { BoqItemId: "asc" },
        },
      },
    });

    if (!overallSiteBudget) return NotFound("Overall site budget not found");
    return Success(overallSiteBudget);
  } catch (error) {
    console.error("Get overall site budget error:", error);
    return Error("Failed to fetch overall site budget");
  }
}

const approvalSchema = z.object({
  statusAction: z.enum(["approveTech", "approveCommercial", "approveProject"]),
});

// PATCH /api/overall-site-budgets/[id] - Approvals only
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid overall site budget ID", 400);

    const body = await req.json();
    const parsed = approvalSchema.parse(body);

    const existing = await (prisma as any).overallSiteBudget.findUnique({
      where: { id },
      select: {
        id: true,
        isTechApprovalDone: true,
        isCommercialApprovalDone: true,
        isProjectApprovalDone: true,
        createdById: true,
        techApprovalById: true,
        commercialApprovalById: true,
        projectApprovalById: true,
      },
    });

    if (!existing) return NotFound("Overall site budget not found");

    const now = new Date();
    const userId = (auth as any).user.id as number;
    const permSet = new Set<string>((auth as any).user.permissions || []);

    if (existing.createdById === userId) {
      return Error("Creator cannot approve this overall site budget", 400);
    }

    const hasAnyPriorApprovalByUser =
      existing.techApprovalById === userId ||
      existing.commercialApprovalById === userId ||
      existing.projectApprovalById === userId;
    if (hasAnyPriorApprovalByUser) {
      return Error(
        "You have already performed an approval on this overall site budget",
        400
      );
    }

    const updateData: any = {};

    if (parsed.statusAction === "approveTech") {
      if (!permSet.has(PERMISSIONS.APPROVE_OVERALL_SITE_BUDGETS_TECH)) {
        return Error("Forbidden", 403);
      }
      if (existing.isTechApprovalDone) return Error("Tech approval already done", 400);
      updateData.isTechApprovalDone = true;
      updateData.techApprovalById = userId;
      updateData.techApprovalAt = now;
    }

    if (parsed.statusAction === "approveCommercial") {
      if (!permSet.has(PERMISSIONS.APPROVE_OVERALL_SITE_BUDGETS_COMMERCIAL)) {
        return Error("Forbidden", 403);
      }
      if (!existing.isTechApprovalDone) {
        return Error("Tech approval is required before commercial approval", 400);
      }
      if (existing.isCommercialApprovalDone) {
        return Error("Commercial approval already done", 400);
      }
      if (existing.techApprovalById === userId) {
        return Error("Tech approver cannot do commercial approval", 400);
      }
      updateData.isCommercialApprovalDone = true;
      updateData.commercialApprovalById = userId;
      updateData.commercialApprovalAt = now;
    }

    if (parsed.statusAction === "approveProject") {
      if (!permSet.has(PERMISSIONS.APPROVE_OVERALL_SITE_BUDGETS_PROJECT)) {
        return Error("Forbidden", 403);
      }
      if (!existing.isCommercialApprovalDone) {
        return Error("Commercial approval is required before project approval", 400);
      }
      if (existing.isProjectApprovalDone) return Error("Project approval already done", 400);
      if (existing.techApprovalById === userId) {
        return Error("Tech approver cannot do project approval", 400);
      }
      if (existing.commercialApprovalById === userId) {
        return Error("Commercial approver cannot do project approval", 400);
      }
      updateData.isProjectApprovalDone = true;
      updateData.projectApprovalById = userId;
      updateData.projectApprovalAt = now;
    }

    const updated = await (prisma as any).overallSiteBudget.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        isTechApprovalDone: true,
        isCommercialApprovalDone: true,
        isProjectApprovalDone: true,
        techApprovalById: true,
        commercialApprovalById: true,
        projectApprovalById: true,
        techApprovalAt: true,
        commercialApprovalAt: true,
        projectApprovalAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return Error(error.errors as any, 400);
    console.error("Overall site budget approval error:", error);
    return Error("Failed to approve overall site budget");
  }
}

// DELETE /api/overall-site-budgets/[id] - Delete overall site budget
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid overall site budget ID", 400);

    await (prisma as any).$transaction(async (tx: any) => {
      const details = await tx.overallSiteBudgetDetail.findMany({
        where: { overallSiteBudgetId: id },
        select: { id: true },
      });
      const detailIds = (details || []).map((d: any) => Number(d.id));
      if (detailIds.length) {
        await tx.overallSiteBudgetItem.deleteMany({
          where: { overallSiteBudgetDetailId: { in: detailIds } },
        });
        await tx.overallSiteBudgetDetail.deleteMany({
          where: { id: { in: detailIds } },
        });
      }
      await tx.overallSiteBudget.delete({ where: { id } });
    });

    return Success({ message: "Overall site budget deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Overall site budget not found");
    if (error.code === "P2003") {
      return Error(
        "This overall site budget is being used in other modules, so it cannot be deleted.",
        400
      );
    }
    console.error("Delete overall site budget error:", error);
    return Error("Failed to delete overall site budget");
  }
}
