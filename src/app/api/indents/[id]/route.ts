import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import { PERMISSIONS, ROLES } from "@/config/roles";

const indentItemSchema = z.object({
  id: z.number().optional(), // For existing items
  itemId: z.coerce.number().min(1, "Item is required"),
  remark: z.string().optional(),
  indentQty: z
    .coerce
    .number()
    .min(0.0001, "Indent quantity must be greater than 0")
    .max(99999999.9999, "Indent quantity must be <= 99,999,999.9999"),
  approved1Qty: z
    .coerce
    .number()
    .min(0.0001, "Approved quantity must be greater than 0")
    .max(99999999.9999, "Approved quantity must be <= 99,999,999.9999")
    .optional(),
  approved2Qty: z
    .coerce
    .number()
    .min(0.0001, "Approved quantity must be greater than 0")
    .max(99999999.9999, "Approved quantity must be <= 99,999,999.9999")
    .optional(),
});

const updateSchema = z.object({
  indentDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  deliveryDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  siteId: z.number().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  remarks: z.string().optional(),
  indentItems: z.array(indentItemSchema).optional(),
  statusAction: z
    .enum(["approve1", "approve2", "complete", "suspend", "unsuspend"])
    .optional(),
});

// GET /api/indents/[id] - Get single indent
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
        priority: true,
        approvalStatus: true,
        suspended: true,
        approved1ById: true,
        approved1At: true,
        approved2ById: true,
        approved2At: true,
        suspendedById: true,
        suspendedAt: true,
        completedById: true,
        completedAt: true,
        createdById: true,
        remarks: true,
        deliveryDate: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        approved1By: { select: { id: true, name: true } },
        approved2By: { select: { id: true, name: true } },
        suspendedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
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
                unitId: true,
                unit: {
                  select: {
                    id: true,
                    unitName: true,
                  },
                },
              },
            },
            remark: true,
            indentQty: true,
            approved1Qty: true,
            approved2Qty: true,
            indentItemPOs: {
              select: {
                id: true,
                orderedQty: true,
                purchaseOrderDetailId: true,
              },
            },
          },
          orderBy: {
            id: "asc",
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
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

      // Only allow normal edits when indent is in DRAFT
      if (!statusAction) {
        const current: any = await tx.indent.findUnique({
          where: { id },
          select: { approvalStatus: true } as any,
        });
        if (!current) {
          throw new Error("BAD_REQUEST: Indent not found");
        }
        if (current.approvalStatus !== "DRAFT") {
          throw new Error("BAD_REQUEST: Only DRAFT indents can be edited");
        }
      }

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
          select: { approvalStatus: true, createdById: true, approved1ById: true } as any,
        });
        if (!current) {
          throw new Error("BAD_REQUEST: Indent not found");
        }

        // Prevent creator from approving their own indent
        if (
          (statusAction === "approve1" || statusAction === "approve2") &&
          current.createdById === auth.user.id
        ) {
          throw new Error("BAD_REQUEST: Creator cannot approve their own indent");
        }

        // Permission check based on action
        const rolePerms = (auth.user.permissions || []) as string[];
        if (statusAction === "approve1") {
          if (!(rolePerms as string[]).includes(PERMISSIONS.APPROVE_INDENTS_L1)) {
            throw new Error("BAD_REQUEST: Missing permission to approve level 1");
          }
        }
        if (statusAction === "approve2") {
          if (!(rolePerms as string[]).includes(PERMISSIONS.APPROVE_INDENTS_L2)) {
            throw new Error("BAD_REQUEST: Missing permission to approve level 2");
          }
        }
        if (statusAction === "complete") {
          if (!(rolePerms as string[]).includes(PERMISSIONS.COMPLETE_INDENTS)) {
            throw new Error("BAD_REQUEST: Missing permission to complete indent");
          }
        }
        if (statusAction === "suspend" || statusAction === "unsuspend") {
          if (!(rolePerms as string[]).includes(PERMISSIONS.SUSPEND_INDENTS)) {
            throw new Error("BAD_REQUEST: Missing permission to suspend/unsuspend indent");
          }
        }
        const now = new Date();
        if (statusAction === "approve1") {
          if (current.approvalStatus !== "DRAFT") {
            throw new Error(
              "BAD_REQUEST: Only DRAFT can be approved (level 1)"
            );
          }
          // If Project Director approves L1, auto-approve L2
          if (auth.user.role === ROLES.PROJECT_DIRECTOR) {
            await tx.indent.update({
              where: { id },
              data: {
                approvalStatus: "APPROVED_LEVEL_2",
                approved1ById: auth.user.id,
                approved1At: now,
                approved2ById: auth.user.id,
                approved2At: now,
              } as any,
            });
            // If items present: set approved2Qty to provided or fallback to approved1Qty
            if (Array.isArray(indentItems) && indentItems.length > 0) {
              for (const item of indentItems) {
                if (!item.id) continue;
                const a1 = item.approved1Qty;
                const a2 = item.approved2Qty ?? a1;
                await tx.indentItem.update({
                  where: { id: item.id },
                  data: {
                    approved1Qty: a1 !== undefined ? a1 : undefined,
                    approved2Qty: a2 !== undefined ? a2 : undefined,
                    updatedAt: now,
                  },
                });
              }
            }
          } else {
            await tx.indent.update({
              where: { id },
              data: {
                approvalStatus: "APPROVED_LEVEL_1",
                approved1ById: auth.user.id,
                approved1At: now,
              } as any,
            });
          }
        } else if (statusAction === "approve2") {
          if (current.approvalStatus !== "APPROVED_LEVEL_1") {
            throw new Error(
              "BAD_REQUEST: Only level 1 approved can be approved (level 2)"
            );
          }
          // Prevent the same user who approved level 1 from approving level 2
          if (current.approved1ById === auth.user.id) {
            throw new Error(
              "BAD_REQUEST: Level 1 approver cannot approve level 2"
            );
          }
          await tx.indent.update({
            where: { id },
            data: {
              approvalStatus: "APPROVED_LEVEL_2",
              approved2ById: auth.user.id,
              approved2At: now,
            } as any,
          });
        } else if (statusAction === "complete") {
          if (current.approvalStatus !== "APPROVED_LEVEL_2") {
            throw new Error(
              "BAD_REQUEST: Only level 2 approved can be completed"
            );
          }
          await tx.indent.update({
            where: { id },
            data: {
              approvalStatus: "COMPLETED",
              completedById: auth.user.id,
              completedAt: now,
            } as any,
          });
        } else if (statusAction === "suspend") {
          if (current.approvalStatus === "COMPLETED") {
            throw new Error(
              "BAD_REQUEST: Completed indent cannot be suspended"
            );
          }
          await tx.indent.update({
            where: { id },
            data: {
              approvalStatus: "SUSPENDED",
              suspended: true,
              suspendedById: auth.user.id,
              suspendedAt: now,
            },
          });
        } else if (statusAction === "unsuspend") {
          await tx.indent.update({
            where: { id },
            data: { suspended: false },
          });
        }
      }

      // If updating items during an approval-type action (non-suspend), ensure approvedQty is provided
      if (
        statusAction &&
        statusAction !== "suspend" &&
        Array.isArray(indentItems)
      ) {
        const missing = indentItems.some((it: any) => {
          if (statusAction === "approve1") {
            return it.approved1Qty == null || Number.isNaN(it.approved1Qty);
          }
          if (statusAction === "approve2") {
            return it.approved2Qty == null || Number.isNaN(it.approved2Qty);
          }
          return false;
        });
        if (missing) {
          throw new Error(
            "BAD_REQUEST: Approved quantity is required for all items"
          );
        }
      }

      // Item updates
      // - For normal edit (no statusAction): allow add/update/remove items
      // - For approval actions: only update existing items by id (do NOT create/delete)
      if (Array.isArray(indentItems)) {
        if (!statusAction) {
          const existing = await tx.indentItem.findMany({
            where: { indentId: id },
            select: { id: true, indentItemPOs: { select: { id: true } } },
          });

          const existingById = new Map(existing.map((it) => [it.id, it]));

          const payloadIds = new Set<number>();
          for (const item of indentItems) {
            if (item.id) payloadIds.add(item.id);
          }

          // Delete removed items (only if not already linked to a PO)
          const removed = existing.filter((it) => !payloadIds.has(it.id));
          const blocked = removed.filter((it) => (it.indentItemPOs || []).length > 0);
          if (blocked.length > 0) {
            throw new Error(
              "BAD_REQUEST: Cannot remove items already linked to a Purchase Order"
            );
          }
          if (removed.length > 0) {
            await tx.indentItem.deleteMany({
              where: { id: { in: removed.map((it) => it.id) } },
            });
          }

          // Upsert payload items
          for (const item of indentItems) {
            if (item.id) {
              const currentItem = existingById.get(item.id);
              if (!currentItem) {
                throw new Error("BAD_REQUEST: Invalid indent item");
              }
              await tx.indentItem.update({
                where: { id: item.id },
                data: {
                  itemId: item.itemId,
                  remark: item.remark ?? null,
                  indentQty: item.indentQty,
                  updatedAt: new Date(),
                },
              });
            } else {
              await tx.indentItem.create({
                data: {
                  indentId: id,
                  itemId: item.itemId,
                  remark: item.remark ?? null,
                  indentQty: item.indentQty,
                },
              });
            }
          }
        } else {
          // Approval-related updates (keep existing behavior)
          if (indentItems.length > 0) {
            for (const item of indentItems) {
              if (!item.id) continue; // skip any item without ID

              const existingItem = await tx.indentItem.findFirst({
                where: { id: item.id, indentId: id },
                select: { id: true },
              });

              if (existingItem) {
                await tx.indentItem.update({
                  where: { id: existingItem.id },
                  data: {
                    remark: item.remark ?? null,
                    indentQty: item.indentQty,
                    approved1Qty:
                      item.approved1Qty !== undefined
                        ? item.approved1Qty
                        : undefined,
                    approved2Qty:
                      item.approved2Qty !== undefined
                        ? item.approved2Qty
                        : undefined,
                    updatedAt: new Date(),
                  },
                });
              }
              // else skip silently — do not create new items
            }
          }
        }
      }

      // Fetch updated indent with items
      const updatedIndent = await tx.indent.findUnique({
        where: { id },
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          deliveryDate: true,
          siteId: true,
          priority: true,
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
              itemId: true,
              item: true,
              remark: true,
              indentQty: true,
              approved1Qty: true,
              approved2Qty: true,
              indentItemPOs: {
                select: {
                  id: true,
                  orderedQty: true,
                  purchaseOrderDetailId: true,
                },
              },
            },
            orderBy: {
              id: "asc",
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
    if (
      typeof error?.message === "string" &&
      error.message.startsWith("BAD_REQUEST:")
    ) {
      return BadRequest(error.message.replace("BAD_REQUEST: ", ""));
    }
    console.error("Update indent error:", error);
    return ApiError("Failed to update indent");
  }
}

// DELETE /api/indents/[id] - Delete indent
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
