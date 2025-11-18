import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";

const workOrderItemSchema = z.object({
  id: z.number().optional(), // For existing items
  itemId: z.coerce.number().min(1, "Item is required"),
  sac_code: z.string().min(1, "SAC code is required"),
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
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
});

const updateSchema = z.object({
  workOrderDate: z
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
  quotationNo: z.string().optional(),
  quotationDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().optional(),
  paymentTermsInDays: z.number().optional(),
  deliverySchedule: z.string().optional(),
  workOrderItems: z.array(workOrderItemSchema).optional(),
  woStatus: z.enum(["HOLD"]).optional().nullable(),
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
  exciseTaxStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  exciseTaxAmount: z.string().nullable().optional(),
  octroiTaxStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  octroiTaxAmount: z.string().nullable().optional(),
});

// GET /api/work-orders/[id] - Get single work order
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid work order ID");

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        workOrderNo: true,
        workOrderDate: true,
        deliveryDate: true,
        siteId: true,
        vendorId: true,
        billingAddressId: true,
        siteDeliveryAddressId: true,
        paymentTermId: true,
        woStatus: true,
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
        exciseTaxStatus: true,
        exciseTaxAmount: true,
        octroiTaxStatus: true,
        octroiTaxAmount: true,
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
        workOrderDetails: {
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
            sac_code: true,
            remark: true,
            qty: true,
            orderedQty: true,
            approved1Qty: true,
            approved2Qty: true,
            rate: true,
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

    if (!workOrder) return NotFound("Work order not found");
    return Success(workOrder);
  } catch (error) {
    console.error("Get work order error:", error);
    return ApiError("Failed to fetch work order");
  }
}

// PATCH /api/work-orders/[id] - Update work order
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid work order ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update work order header
      const { workOrderItems, statusAction, ...woData } = updateData as any;

      // Update basic fields if provided
      if (Object.keys(woData).length > 0 || statusAction) {
        const updateData: any = { ...woData };

        // Handle status actions
        if (statusAction) {
          const current: any = await tx.workOrder.findUnique({
            where: { id },
            select: {
              approvalStatus: true,
              isApproved1: true,
              isApproved2: true,
              isComplete: true,
            } as any,
          });

          if (!current) {
            throw new Error("BAD_REQUEST: Work order not found");
          }

          const now = new Date();

          if (statusAction === "approve1") {
            if (current.approvalStatus !== "DRAFT") {
              throw new Error(
                "BAD_REQUEST: Only DRAFT can be approved (level 1)"
              );
            }
            updateData.approvalStatus = "APPROVED_LEVEL_1";
            updateData.isApproved1 = true;
            updateData.approved1ById = auth.user.id;
            updateData.approved1At = now;
          } else if (statusAction === "approve2") {
            if (current.approvalStatus !== "APPROVED_LEVEL_1") {
              throw new Error(
                "BAD_REQUEST: Only level 1 approved can be approved (level 2)"
              );
            }
            updateData.approvalStatus = "APPROVED_LEVEL_2";
            updateData.isApproved2 = true;
            updateData.approved2ById = auth.user.id;
            updateData.approved2At = now;
          } else if (statusAction === "complete") {
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
            if (current.approvalStatus === "COMPLETED") {
              throw new Error(
                "BAD_REQUEST: Completed work order cannot be suspended"
              );
            }
            updateData.approvalStatus = "SUSPENDED";
            updateData.isSuspended = true;
            updateData.suspendedById = auth.user.id;
            updateData.suspendedAt = now;
          } else if (statusAction === "unsuspend") {
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

        if (typeof woData.amount === "number") {
          updateData.amountInWords = amountInWords(woData.amount);
        }

        // Always update the updatedAt and updatedById
        updateData.updatedAt = new Date();
        updateData.updatedById = auth.user.id;

        await tx.workOrder.update({
          where: { id },
          data: updateData,
        });
      }

      // Update or create work order items
      if (workOrderItems && workOrderItems.length > 0) {
        // Get existing item IDs to identify which ones to delete
        const existingItems = await tx.workOrderDetail.findMany({
          where: { workOrderId: id },
          select: { id: true },
        });

        const existingItemIds = new Set(existingItems.map((item) => item.id));
        const updatedItemIds = new Set<number>();

        // Process each item in the request
        for (const [index, item] of workOrderItems.entries()) {
          const itemData: any = {
            serialNo: index + 1,
            itemId: item.itemId,
            sac_code: item.sac_code,
            remark: item.remark || null,
            qty: item.qty,
            orderedQty: item.orderedQty ?? null,
            approved1Qty: item.approved1Qty ?? null,
            approved2Qty: item.approved2Qty ?? null,
            rate: item.rate,
            cgstPercent: item.cgstPercent || 0,
            sgstPercent: item.sgstPercent || 0,
            igstPercent: item.igstPercent || 0,
            cgstAmt: item.cgstAmt,
            sgstAmt: item.sgstAmt,
            igstAmt: item.igstAmt,
            amount: item.amount,
            updatedAt: new Date(),
          };

          if (item.id && existingItemIds.has(item.id)) {
            // Update existing item
            await tx.workOrderDetail.update({
              where: { id: item.id },
              data: itemData,
            });
            updatedItemIds.add(item.id);
          } else {
            // Create new item
            const newItem = await tx.workOrderDetail.create({
              data: {
                ...itemData,
                workOrderId: id,
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
          await tx.workOrderDetail.deleteMany({
            where: {
              id: { in: itemsToDelete.map((item) => item.id) },
            },
          });
        }
      }

      // Fetch the updated work order with items
      const updatedWO = await tx.workOrder.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          workOrderNo: true,
          workOrderDate: true,
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
          woStatus: true,
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
          exciseTaxStatus: true,
          exciseTaxAmount: true,
          octroiTaxStatus: true,
          octroiTaxAmount: true,
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
          workOrderDetails: {
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
              sac_code: true,
              remark: true,
              qty: true,
              orderedQty: true,
              approved1Qty: true,
              approved2Qty: true,
              rate: true,
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

      return updatedWO;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.message && error.message.startsWith("BAD_REQUEST:")) {
      return BadRequest(error.message.replace("BAD_REQUEST: ", ""));
    }
    console.error("Update work order error:", error);
    return ApiError("Failed to update work order");
  }
}

// DELETE /api/work-orders/[id] - Delete work order
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid work order ID");

    // Check if work order exists and is in a deletable state
    const existingWO = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        approvalStatus: true,
        isComplete: true,
      },
    });

    if (!existingWO) {
      return NotFound("Work order not found");
    }

    // Prevent deletion of approved or completed WOs
    if (existingWO.approvalStatus !== "DRAFT" || existingWO.isComplete) {
      return BadRequest(
        "Cannot delete a work order that is not in DRAFT status or is already completed"
      );
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction([
      // First delete all related work order details
      prisma.workOrderDetail.deleteMany({
        where: { workOrderId: id },
      }),

      // Then delete the work order
      prisma.workOrder.delete({
        where: { id },
      }),
    ]);

    return Success({ success: true });
  } catch (error) {
    console.error("Delete work order error:", error);
    return ApiError("Failed to delete work order");
  }
}
