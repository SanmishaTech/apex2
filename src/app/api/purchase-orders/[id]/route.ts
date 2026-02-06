import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";

const purchaseOrderItemSchema = z.object({
  id: z.number().optional(), // For existing items
  itemId: z.coerce.number().min(1, "Item is required"),
  remark: z.string().nullable().optional(),
  qty: z.coerce
    .number()
    .min(0.0001, "Quantity must be greater than 0")
    .max(9999999999.9999, "Quantity must be <= 9,999,999,999.9999"),
  orderedQty: z.coerce
    .number()
    .min(0, "Ordered quantity must be non-negative")
    .max(9999999999.9999, "Ordered quantity must be <= 9,999,999,999.9999")
    .optional()
    .nullable(),
  approved1Qty: z.coerce
    .number()
    .min(0, "Approved quantity must be non-negative")
    .max(9999999999.9999, "Approved quantity must be <= 9,999,999,999.9999")
    .optional()
    .nullable(),
  approved2Qty: z.coerce
    .number()
    .min(0, "Approved quantity must be non-negative")
    .max(9999999999.9999, "Approved quantity must be <= 9,999,999,999.9999")
    .optional()
    .nullable(),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discountPercent: z.coerce
    .number()
    .min(0, "Discount % must be non-negative")
    .max(100, "Discount % must be <= 100")
    .default(0),
  cgstPercent: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .default(0),
  sgstPercent: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .default(0),
  igstPercent: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .default(0),
  disAmt: z.coerce.number(),
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
});

const updateSchema = z.object({
  purchaseOrderDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  deliveryDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  siteId: z.number().optional(),
  vendorId: z.number().optional(),
  billingAddressId: z.number().optional(),
  siteDeliveryAddressId: z.number().optional(),
  paymentTermId: z.number().nullable().optional(),
  paymentTermIds: z
    .array(z.coerce.number())
    .optional()
    .transform((arr) =>
      Array.from(
        new Set(
          (arr || [])
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
    ),
  quotationNo: z.string().optional(),
  quotationDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().nullable().optional(),
  paymentTermsInDays: z.number().optional(),
  deliverySchedule: z.string().optional(),
  purchaseOrderItems: z.array(purchaseOrderItemSchema).optional(),
  poStatus: z.enum(["HOLD"]).optional().nullable(),
  statusAction: z
    .enum(["approve1", "approve2", "complete", "suspend", "unsuspend"])
    .optional(),
  amount: z.coerce.number().optional(),
  totalCgstAmount: z.coerce.number().optional(),
  totalSgstAmount: z.coerce.number().optional(),
  totalIgstAmount: z.coerce.number().optional(),
  transitInsuranceStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  transitInsuranceAmount: z.string().nullable().optional(),
  pfStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  pfCharges: z.string().nullable().optional(),
  gstReverseStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  gstReverseAmount: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  billStatus: z.string().nullable().optional(),
});

// GET /api/purchase-orders/[id] - Get single purchase order
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid purchase order ID");

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        purchaseOrderNo: true,
        purchaseOrderDate: true,
        deliveryDate: true,
        siteId: true,
        vendorId: true,
        billingAddressId: true,
        siteDeliveryAddressId: true,
        paymentTermId: true,
        poStatus: true,
        quotationNo: true,
        quotationDate: true,
        transport: true,
        note: true,
        terms: true,
        paymentTermsInDays: true,
        deliverySchedule: true,
        amount: true,
        amountInWords: true,
        totalCgstAmount: true,
        totalSgstAmount: true,
        totalIgstAmount: true,
        transitInsuranceStatus: true,
        transitInsuranceAmount: true,
        pfStatus: true,
        pfCharges: true,
        gstReverseStatus: true,
        gstReverseAmount: true,
        approvalStatus: true,
        isSuspended: true,
        isComplete: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        vendor: {
          select: {
            id: true,
            vendorName: true,
          },
        },
        billingAddress: {
          select: {
            id: true,
            companyName: true,
            addressLine1: true,
            city: true,
          },
        },
        siteDeliveryAddress: {
          select: {
            id: true,
            addressLine1: true,
            addressLine2: true,
            cityId: true,
            stateId: true,
            pinCode: true,
            city: {
              select: {
                id: true,
                city: true,
              },
            },
            state: {
              select: {
                id: true,
                state: true,
              },
            },
          },
        },
        paymentTerm: {
          select: {
            id: true,
            paymentTerm: true,
          },
        },
        poPaymentTerms: {
          select: {
            paymentTermId: true,
            paymentTerm: {
              select: {
                id: true,
                paymentTerm: true,
                description: true,
              },
            },
          },
        },
        purchaseOrderDetails: {
          select: {
            id: true,
            serialNo: true,
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
            qty: true,
            orderedQty: true,
            approved1Qty: true,
            approved2Qty: true,
            rate: true,
            discountPercent: true,
            disAmt: true,
            cgstPercent: true,
            cgstAmt: true,
            sgstPercent: true,
            sgstAmt: true,
            igstPercent: true,
            igstAmt: true,
            amount: true,
          },
          orderBy: {
            serialNo: "asc",
          },
        },
      } as any,
    });

    if (!purchaseOrder) return NotFound("Purchase order not found");
    return Success(purchaseOrder);
  } catch (error) {
    console.error("Get purchase order error:", error);
    return ApiError("Failed to fetch purchase order");
  }
}

// PATCH /api/purchase-orders/[id] - Update purchase order
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid purchase order ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.prototype.hasOwnProperty.call(updateData, "terms")) {
      (updateData as any).terms = null;
    }

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const result = await prisma.$transaction(async (tx) => {
      let autoApproved2 = false;
      // Update purchase order header
      const {
        purchaseOrderItems,
        statusAction,
        paymentTermIds: paymentTermIdsRaw,
        ...poData
      } = updateData as any;

      const paymentTermIdsFromRaw: number[] | undefined = Array.isArray(
        paymentTermIdsRaw
      )
        ? (paymentTermIdsRaw as number[])
        : undefined;

      const paymentTermIdsFromSingle: number[] | undefined =
        typeof (updateData as any).paymentTermId === "number" &&
        Number.isFinite(Number((updateData as any).paymentTermId)) &&
        Number((updateData as any).paymentTermId) > 0
          ? [Number((updateData as any).paymentTermId)]
          : Object.prototype.hasOwnProperty.call(updateData, "paymentTermId")
          ? []
          : undefined;

      const nextPaymentTermIds: number[] | undefined =
        paymentTermIdsFromRaw ?? paymentTermIdsFromSingle;

      // Update basic fields if provided
      if (Object.keys(poData).length > 0 || statusAction) {
        const updateData: any = { ...poData };

        if (nextPaymentTermIds !== undefined) {
          updateData.paymentTermId =
            nextPaymentTermIds.length > 0
              ? Number(nextPaymentTermIds[0])
              : null;

          await tx.pOPaymentTerm.deleteMany({
            where: { purchaseOrderId: id },
          });
          if (nextPaymentTermIds.length > 0) {
            await tx.pOPaymentTerm.createMany({
              data: nextPaymentTermIds.map((paymentTermId) => ({
                purchaseOrderId: id,
                paymentTermId,
              })),
              skipDuplicates: true,
            });
          }
        }

        // Handle status actions
        if (statusAction) {
          // Permission check per action
          const permSet = new Set((auth.user.permissions || []) as string[]);
          const has = (p: string) => permSet.has(p);
          const current: any = await tx.purchaseOrder.findUnique({
            where: { id },
            select: {
              approvalStatus: true,
              isApproved1: true,
              isApproved2: true,
              isComplete: true,
              createdById: true,
              approved1ById: true,
              amount: true,
              siteId: true,
              purchaseOrderDetails: {
                select: {
                  itemId: true,
                  qty: true,
                  rate: true,
                  item: { select: { item: true } },
                },
              },
            } as any,
          });

          if (!current) {
            throw new Error("BAD_REQUEST: Purchase order not found");
          }

          const now = new Date();

          if (statusAction === "approve1") {
            if (!has(PERMISSIONS.APPROVE_PURCHASE_ORDERS_L1)) {
              throw new Error(
                "BAD_REQUEST: Missing permission to approve level 1"
              );
            }
            if (current.approvalStatus !== "DRAFT") {
              throw new Error(
                "BAD_REQUEST: Only DRAFT can be approved (level 1)"
              );
            }
            if (current.createdById === auth.user.id) {
              throw new Error("BAD_REQUEST: Creator cannot approve level 1");
            }
            // Approve Level 1
            updateData.approvalStatus = "APPROVED_LEVEL_1";
            updateData.isApproved1 = true;
            updateData.approved1ById = auth.user.id;
            updateData.approved1At = now;
            // Auto-approve Level 2 when total amount <= 100000 OR when PD has L2 permission
            const totalForDecision =
              typeof (poData as any).amount === "number"
                ? Number((poData as any).amount)
                : Number(current.amount || 0);
            if (
              totalForDecision <= 100000 ||
              (auth.user.role === ROLES.PROJECT_DIRECTOR &&
                has(PERMISSIONS.APPROVE_PURCHASE_ORDERS_L2))
            ) {
              updateData.approvalStatus = "APPROVED_LEVEL_2";
              updateData.isApproved2 = true;
              updateData.approved2ById = auth.user.id;
              updateData.approved2At = now;
              autoApproved2 = true;
            }
          } else if (statusAction === "approve2") {
            if (!has(PERMISSIONS.APPROVE_PURCHASE_ORDERS_L2)) {
              throw new Error(
                "BAD_REQUEST: Missing permission to approve level 2"
              );
            }
            if (current.approvalStatus !== "APPROVED_LEVEL_1") {
              throw new Error(
                "BAD_REQUEST: Only level 1 approved can be approved (level 2)"
              );
            }
            if (current.createdById === auth.user.id) {
              throw new Error("BAD_REQUEST: Creator cannot approve level 2");
            }
            if (current.approved1ById === auth.user.id) {
              throw new Error(
                "BAD_REQUEST: Level 1 approver cannot approve level 2"
              );
            }
            updateData.approvalStatus = "APPROVED_LEVEL_2";
            updateData.isApproved2 = true;
            updateData.approved2ById = auth.user.id;
            updateData.approved2At = now;
          } else if (statusAction === "complete") {
            if (!has(PERMISSIONS.COMPLETE_PURCHASE_ORDERS)) {
              throw new Error(
                "BAD_REQUEST: Missing permission to complete purchase orders"
              );
            }
            if (current.approvalStatus !== "APPROVED_LEVEL_2") {
              throw new Error(
                "BAD_REQUEST: Only level 2 approved can be completed"
              );
            }
            updateData.approvalStatus = "COMPLETED";
            updateData.completedById = auth.user.id;
            updateData.completedAt = now;
            updateData.isComplete = true;
          } else if (statusAction === "suspend") {
            if (!has(PERMISSIONS.SUSPEND_PURCHASE_ORDERS)) {
              throw new Error(
                "BAD_REQUEST: Missing permission to suspend purchase orders"
              );
            }
            if (current.approvalStatus === "COMPLETED") {
              throw new Error(
                "BAD_REQUEST: Completed purchase order cannot be suspended"
              );
            }
            updateData.approvalStatus = "SUSPENDED";
            updateData.isSuspended = true;
            updateData.suspendedById = auth.user.id;
            updateData.suspendedAt = now;
          } else if (statusAction === "unsuspend") {
            if (!has(PERMISSIONS.SUSPEND_PURCHASE_ORDERS)) {
              throw new Error(
                "BAD_REQUEST: Missing permission to unsuspend purchase orders"
              );
            }
            updateData.isSuspended = false;
            // Restore the correct approval status based on approval flags
            if (current.isComplete) {
              updateData.approvalStatus = "COMPLETED";
            } else if (current.isApproved2) {
              updateData.approvalStatus = "APPROVED_LEVEL_2";
            } else if (current.isApproved1) {
              updateData.approvalStatus = "APPROVED_LEVEL_1";
            } else {
              updateData.approvalStatus = "DRAFT";
            }
          }
        }

        if (typeof poData.amount === "number") {
          updateData.amountInWords = amountInWords(poData.amount);
        }

        // Enforce field-level update permissions (remarks, billStatus)
        if (Object.prototype.hasOwnProperty.call(poData, "remarks")) {
          const rolePerms = (auth.user.permissions || []) as string[];
          if (
            !(rolePerms as string[]).includes(
              PERMISSIONS.UPDATE_PURCHASE_ORDER_REMARKS
            )
          ) {
            throw new Error(
              "BAD_REQUEST: Missing permission to update remarks"
            );
          }
        }
        if (Object.prototype.hasOwnProperty.call(poData, "billStatus")) {
          const rolePerms = (auth.user.permissions || []) as string[];
          if (
            !(rolePerms as string[]).includes(
              PERMISSIONS.UPDATE_PURCHASE_ORDER_BILL_STATUS
            )
          ) {
            throw new Error(
              "BAD_REQUEST: Missing permission to update bill status"
            );
          }
        }

        // Always update the updatedAt and updatedById
        updateData.updatedAt = new Date();
        updateData.updatedById = auth.user.id;

        await tx.purchaseOrder.update({
          where: { id },
          data: updateData,
        });
      }

      // Update or create purchase order items
      if (purchaseOrderItems && purchaseOrderItems.length > 0) {
        // Get existing item IDs to identify which ones to delete
        const existingItems = await tx.purchaseOrderDetail.findMany({
          where: { purchaseOrderId: id },
          select: { id: true },
        });

        const existingItemIds = new Set(existingItems.map((item) => item.id));
        const updatedItemIds = new Set<number>();

        // Process each item in the request
        for (const [index, item] of purchaseOrderItems.entries()) {
          const itemData: any = {
            serialNo: index + 1,
            itemId: item.itemId,
            remark: item.remark || null,
            qty: item.qty,
            orderedQty: item.orderedQty ?? null,
            approved1Qty: item.approved1Qty ?? null,
            approved2Qty:
              item.approved2Qty ??
              (autoApproved2
                ? (item.approved1Qty ?? item.qty ?? null)
                : null),
            rate: item.rate,
            discountPercent: item.discountPercent || 0,
            cgstPercent: item.cgstPercent || 0,
            sgstPercent: item.sgstPercent || 0,
            igstPercent: item.igstPercent || 0,
            disAmt: item.disAmt,
            cgstAmt: item.cgstAmt,
            sgstAmt: item.sgstAmt,
            igstAmt: item.igstAmt,
            amount: item.amount,
            updatedAt: new Date(),
          };

          if (item.id && existingItemIds.has(item.id)) {
            // Update existing item
            await tx.purchaseOrderDetail.update({
              where: { id: item.id },
              data: itemData,
            });
            updatedItemIds.add(item.id);
          } else {
            // Create new item
            const newItem = await tx.purchaseOrderDetail.create({
              data: {
                ...itemData,
                purchaseOrderId: id,
              },
            });
            updatedItemIds.add(newItem.id);
          }
        }

        // Delete items that were not included in the update
        const itemsToDelete = existingItems.filter(
          (item) => !updatedItemIds.has(item.id)
        );
        if (itemsToDelete.length > 0) {
          await tx.purchaseOrderDetail.deleteMany({
            where: {
              id: { in: itemsToDelete.map((item) => item.id) },
            },
          });
        }
      } else if (autoApproved2) {
        // Auto-approval to level 2 happened, but no items were sent in the payload.
        // Ensure approved2Qty is persisted based on the existing row values.
        const existingDetails = await tx.purchaseOrderDetail.findMany({
          where: { purchaseOrderId: id },
          select: { id: true, approved1Qty: true, qty: true },
        });
        for (const d of existingDetails) {
          const approved2Qty = d.approved1Qty ?? d.qty ?? null;
          await tx.purchaseOrderDetail.update({
            where: { id: d.id },
            data: { approved2Qty },
          });
        }
      }

      // Fetch the updated purchase order with items
      const updatedPO = await tx.purchaseOrder.findUnique({
        where: { id },
        select: {
          id: true,
          purchaseOrderNo: true,
          purchaseOrderDate: true,
          deliveryDate: true,
          siteId: true,
          vendorId: true,
          billingAddressId: true,
          siteDeliveryAddressId: true,
          paymentTermId: true,
          quotationNo: true,
          quotationDate: true,
          transport: true,
          note: true,
          terms: true,
          poStatus: true,
          paymentTermsInDays: true,
          deliverySchedule: true,
          amount: true,
          amountInWords: true,
          totalCgstAmount: true,
          totalSgstAmount: true,
          totalIgstAmount: true,
          transitInsuranceStatus: true,
          transitInsuranceAmount: true,
          pfStatus: true,
          pfCharges: true,
          gstReverseStatus: true,
          gstReverseAmount: true,
          approvalStatus: true,
          isSuspended: true,
          isComplete: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          vendor: {
            select: {
              id: true,
              vendorName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
              city: true,
            },
          },
          siteDeliveryAddress: {
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              cityId: true,
              stateId: true,
              pinCode: true,
              city: {
                select: {
                  id: true,
                  city: true,
                },
              },
              state: {
                select: {
                  id: true,
                  state: true,
                },
              },
            },
          },
          paymentTerm: {
            select: {
              id: true,
              paymentTerm: true,
              description: true,
            },
          },
          poPaymentTerms: {
            select: {
              paymentTermId: true,
              paymentTerm: {
                select: {
                  id: true,
                  paymentTerm: true,
                  description: true,
                },
              },
            },
          },
          purchaseOrderDetails: {
            select: {
              id: true,
              serialNo: true,
              itemId: true,
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  item: true,
                  unit: {
                    select: {
                      id: true,
                      unitName: true,
                    },
                  },
                },
              },
              remark: true,
              qty: true,
              orderedQty: true,
              approved1Qty: true,
              approved2Qty: true,
              rate: true,
              discountPercent: true,
              disAmt: true,
              cgstPercent: true,
              cgstAmt: true,
              sgstPercent: true,
              sgstAmt: true,
              igstPercent: true,
              igstAmt: true,
              amount: true,
            },
            orderBy: {
              serialNo: "asc",
            },
          },
          approved1By: {
            select: {
              id: true,
              name: true,
            },
          },
          approved1At: true,
          approved2By: {
            select: {
              id: true,
              name: true,
            },
          },
          approved2At: true,
          completedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          completedAt: true,
          suspendedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          suspendedAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return updatedPO;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.message && error.message.startsWith("BAD_REQUEST:")) {
      return BadRequest(error.message.replace("BAD_REQUEST: ", ""));
    }
    console.error("Update purchase order error:", error);
    return ApiError("Failed to update purchase order");
  }
}

// DELETE /api/purchase-orders/[id] - Delete purchase order
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid purchase order ID");

    // Check if purchase order exists and is in a deletable state
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        approvalStatus: true,
        isComplete: true,
      },
    });

    if (!existingPO) {
      return NotFound("Purchase order not found");
    }

    // Prevent deletion of approved or completed POs
    if (existingPO.approvalStatus !== "DRAFT" || existingPO.isComplete) {
      return BadRequest(
        "Cannot delete a purchase order that is not in DRAFT status or is already completed"
      );
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction([
      // First delete all related purchase order details
      prisma.purchaseOrderDetail.deleteMany({
        where: { purchaseOrderId: id },
      }),

      // Then delete the purchase order
      prisma.purchaseOrder.delete({
        where: { id },
      }),
    ]);

    return Success({ success: true });
  } catch (error) {
    console.error("Delete purchase order error:", error);
    return ApiError("Failed to delete purchase order");
  }
}
