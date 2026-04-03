import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";
import { z } from "zod";

const invoiceItemSchema = z.object({
  id: z.number().optional(),
  subContractorWorkOrderDetailId: z.coerce.number().min(1, "Work Order Item is required"),
  particulars: z.string().min(1, "Particulars are required"),
  workOrderQty: z.coerce.number().min(0, "Work Order Qty must be non-negative"),
  currentBillQty: z.coerce.number().min(0.0001, "Current Bill Qty must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  discountAmount: z.coerce.number().default(0),
  cgstPercent: z.coerce.number().min(0).max(100).default(0),
  sgstpercent: z.coerce.number().min(0).max(100).default(0),
  igstPercent: z.coerce.number().min(0).max(100).default(0),
  cgstAmt: z.coerce.number().default(0),
  sgstAmt: z.coerce.number().default(0),
  igstAmt: z.coerce.number().default(0),
  totalLineAmount: z.coerce.number(),
});

const updateSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required").optional(),
  subcontractorWorkOrderId: z.coerce.number().min(1, "Work Order is required").optional(),
  invoiceNumber: z.string().min(1, "Invoice Number is required").optional(),
  invoiceDate: z.string().transform((val) => new Date(val)).optional(),
  fromDate: z.string().optional().nullable().transform((val) => (val === undefined ? undefined : (val ? new Date(val) : null))),
  toDate: z.string().optional().nullable().transform((val) => (val === undefined ? undefined : (val ? new Date(val) : null))),
  grossAmount: z.coerce.number().min(0, "Gross Amount must be non-negative").optional(),
  retentionAmount: z.coerce.number().min(0).optional(),
  tds: z.coerce.number().min(0).optional(),
  lwf: z.coerce.number().min(0).optional(),
  otherDeductions: z.coerce.number().min(0).optional(),
  netPayable: z.coerce.number().min(0).optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  isAuthorized: z.boolean().optional(),
  invoiceItems: z.array(invoiceItemSchema).optional(),
  statusAction: z.enum(["authorize", "markPaid"]).optional(),
  remarks: z.string().optional().nullable(),
});

// GET /api/sub-contractor-invoices/[id] - Get single invoice
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const permSet = new Set((auth.user.permissions || []) as string[]);
  if (!permSet.has(PERMISSIONS.READ_SUB_CONTRACTOR_INVOICES)) {
    return BadRequest("Missing permission to read sub contractor invoices");
  }

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const invoice = await prisma.subContractorInvoice.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, site: true, siteCode: true } },
        subcontractorWorkOrder: {
          include: {
            subContractor: { select: { id: true, name: true, contactPerson: true } },
            vendor: { select: { id: true, vendorName: true, gstNumber: true } },
            billingAddress: { include: { state: true, city: true } },
            subContractorWorkOrderDetails: {
              include: { unit: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true } },
        subContractorInvoiceDetails: {
          include: {
            subContractorWorkOrderDetail: {
              include: { unit: true },
            },
          },
        },
      },
    });

    if (!invoice) return NotFound("Invoice not found");
    return Success(invoice);
  } catch (error) {
    console.error("Get sub contractor invoice error:", error);
    return ApiError("Failed to fetch sub contractor invoice");
  }
}

// PATCH /api/sub-contractor-invoices/[id] - Update invoice
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.subContractorInvoice.findUnique({
        where: { id },
        include: { subContractorInvoiceDetails: true },
      });

      if (!current) throw new Error("Invoice not found");

      const { invoiceItems, statusAction, remarks, ...baseData } = updateData;
      const dataToUpdate: any = { ...baseData };
      const now = new Date();

      // Handle status actions
      if (statusAction) {
        const permSet = new Set((auth.user.permissions || []) as string[]);
        const isCreator = current.createdById === auth.user.id;

        if (statusAction === "authorize") {
          if (!permSet.has(PERMISSIONS.AUTHORIZE_SUB_CONTRACTOR_INVOICES)) {
            throw new Error("No authorize permission");
          }
          if (isCreator) throw new Error("Creator cannot authorize their own invoice");
          if (current.isAuthorized) throw new Error("Invoice already authorized");
          
          dataToUpdate.isAuthorized = true;
          dataToUpdate.authorizedById = auth.user.id;
          dataToUpdate.authorizedAt = new Date();
        } else if (statusAction === "markPaid") {
          if (!permSet.has(PERMISSIONS.EDIT_SUB_CONTRACTOR_INVOICES)) {
            throw new Error("No permission to mark as paid");
          }
          if (!current.isAuthorized) throw new Error("Invoice must be authorized before marking as paid");
          dataToUpdate.status = "PAID";
        }
      } else {
        const permSet = new Set((auth.user.permissions || []) as string[]);
        if (!permSet.has(PERMISSIONS.EDIT_SUB_CONTRACTOR_INVOICES)) {
          throw new Error("No edit permission");
        }
      }

      dataToUpdate.updatedById = auth.user.id;

      // If already authorized, only allow status changes
      if (current.isAuthorized && !statusAction && Object.keys(dataToUpdate).length > 0) {
        const allowedFields = ["status", "updatedById", "remarks"];
        const disallowedKeys = Object.keys(dataToUpdate).filter(k => !allowedFields.includes(k));
        if (disallowedKeys.length > 0) {
          throw new Error("Cannot edit authorized invoice except for status changes");
        }
      }

      const updated = await tx.subContractorInvoice.update({
        where: { id },
        data: dataToUpdate,
      });

      // Update invoice items if provided
      if (invoiceItems) {
        // Delete existing items
        await tx.subContractorInvoiceDetail.deleteMany({
          where: { subContractorInvoiceId: id },
        });

        // Create new items
        await tx.subContractorInvoiceDetail.createMany({
          data: invoiceItems.map((item) => ({
            subContractorInvoiceId: id,
            subContractorWorkOrderDetailId: item.subContractorWorkOrderDetailId,
            particulars: item.particulars,
            workOrderQty: item.workOrderQty,
            currentBillQty: item.currentBillQty,
            rate: item.rate,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            cgstPercent: item.cgstPercent,
            sgstpercent: item.sgstpercent,
            igstPercent: item.igstPercent,
            cgstAmt: item.cgstAmt,
            sgstAmt: item.sgstAmt,
            igstAmt: item.igstAmt,
            totalLineAmount: item.totalLineAmount,
          })),
        });
      }

      // Create log entry
      const logType = statusAction === "authorize" 
        ? "AUTHORIZE" 
        : statusAction === "markPaid" 
          ? "UPDATE" 
          : "UPDATE";

      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });

      const log = await tx.subContractorInvoiceLog.create({
        data: {
          subContractorInvoiceId: updated.id,
          siteId: updated.siteId,
          subcontractorWorkOrderId: updated.subcontractorWorkOrderId,
          invoiceNumber: updated.invoiceNumber,
          invoiceDate: updated.invoiceDate,
          fromDate: updated.fromDate,
          toDate: updated.toDate,
          logType,
          grossAmount: updated.grossAmount,
          retentionAmount: updated.retentionAmount,
          tds: updated.tds,
          lwf: updated.lwf,
          otherDeductions: updated.otherDeductions,
          netPayable: updated.netPayable,
          status: updated.status,
          isAuthorized: updated.isAuthorized,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Fetch final details after update to log them
      const finalDetails = await tx.subContractorInvoiceDetail.findMany({
        where: { subContractorInvoiceId: updated.id },
      });

      // Create detail logs
      await tx.subContractorInvoiceDetailLog.createMany({
        data: finalDetails.map((d: any) => ({
          subContractorInvoiceLogId: log.id,
          subContractorInvoiceDetailId: d.id,
          subContractorWorkOrderDetailId: d.subContractorWorkOrderDetailId,
          particulars: d.particulars,
          workOrderQty: d.workOrderQty,
          currentBillQty: d.currentBillQty,
          rate: d.rate,
          discountPercent: d.discountPercent,
          discountAmount: d.discountAmount,
          cgstPercent: d.cgstPercent,
          sgstpercent: d.sgstpercent,
          igstPercent: d.igstPercent,
          cgstAmt: d.cgstAmt,
          sgstAmt: d.sgstAmt,
          igstAmt: d.igstAmt,
          totalLineAmount: d.totalLineAmount,
        })),
      });

      return updated;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    console.error("Update sub contractor invoice error:", error);
    return ApiError(error.message || "Failed to update sub contractor invoice");
  }
}

// DELETE /api/sub-contractor-invoices/[id] - Delete invoice
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (!permSet.has(PERMISSIONS.DELETE_SUB_CONTRACTOR_INVOICES)) {
      return BadRequest("Missing permission to delete");
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.subContractorInvoice.findUnique({
        where: { id },
      });

      if (!current) throw new Error("Invoice not found");
      if (current.isAuthorized) throw new Error("Cannot delete authorized invoice");

      // Fetch details before delete for logging
      const details = await tx.subContractorInvoiceDetail.findMany({
        where: { subContractorInvoiceId: id },
      });

      // Delete invoice details
      await tx.subContractorInvoiceDetail.deleteMany({
        where: { subContractorInvoiceId: id },
      });

      // Create log entry for delete
      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });

      const log = await tx.subContractorInvoiceLog.create({
        data: {
          subContractorInvoiceId: current.id,
          siteId: current.siteId,
          subcontractorWorkOrderId: current.subcontractorWorkOrderId,
          invoiceNumber: current.invoiceNumber,
          invoiceDate: current.invoiceDate,
          fromDate: current.fromDate,
          toDate: current.toDate,
          logType: "DELETE",
          grossAmount: current.grossAmount,
          retentionAmount: current.retentionAmount,
          tds: current.tds,
          lwf: current.lwf,
          otherDeductions: current.otherDeductions,
          netPayable: current.netPayable,
          status: current.status,
          isAuthorized: current.isAuthorized,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Create detail logs
      await tx.subContractorInvoiceDetailLog.createMany({
        data: details.map((d: any) => ({
          subContractorInvoiceLogId: log.id,
          subContractorInvoiceDetailId: d.id,
          subContractorWorkOrderDetailId: d.subContractorWorkOrderDetailId,
          particulars: d.particulars,
          workOrderQty: d.workOrderQty,
          currentBillQty: d.currentBillQty,
          rate: d.rate,
          discountPercent: d.discountPercent,
          discountAmount: d.discountAmount,
          cgstPercent: d.cgstPercent,
          sgstpercent: d.sgstpercent,
          igstPercent: d.igstPercent,
          cgstAmt: d.cgstAmt,
          sgstAmt: d.sgstAmt,
          igstAmt: d.igstAmt,
          totalLineAmount: d.totalLineAmount,
        })),
      });

      // Delete the invoice
      await tx.subContractorInvoice.delete({
        where: { id },
      });
    });

    return Success({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Delete sub contractor invoice error:", error);
    return ApiError(error.message || "Failed to delete sub contractor invoice");
  }
}
