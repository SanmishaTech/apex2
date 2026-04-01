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
import { z } from "zod";

const salesInvoiceDetailSchema = z.object({
  id: z.number().optional(),
  boqItemId: z.coerce.number().min(1, "BOQ Item is required"),
  particulars: z.string().nullable().optional(),
  totalBoqQty: z.coerce
    .number()
    .min(0, "Total BOQ Qty must be non-negative")
    .max(9999999999.9999, "Total BOQ Qty must be <= 9,999,999,999.9999"),
  invoiceQty: z.coerce
    .number()
    .min(0.0001, "Invoice Qty must be greater than 0")
    .max(9999999999.9999, "Invoice Qty must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discount: z.coerce
    .number()
    .min(0, "Discount must be non-negative")
    .max(9999999999.99, "Discount must be <= 9,999,999,999.99")
    .optional()
    .nullable(),
  discountAmount: z.coerce.number().optional().nullable(),
  cgst: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .optional()
    .nullable(),
  cgstAmt: z.coerce.number().optional().nullable(),
  sgst: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .optional()
    .nullable(),
  sgstAmt: z.coerce.number().optional().nullable(),
  igst: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .optional()
    .nullable(),
  igstAmt: z.coerce.number().optional().nullable(),
  amount: z.coerce.number(),
});

const updateSchema = z.object({
  invoiceDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  fromDate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? new Date(val) : null)),
  toDate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? new Date(val) : null)),
  siteId: z.number().optional(),
  boqId: z.number().optional(),
  billingAddressId: z.number().optional(),
  grossAmount: z.coerce.number().optional(),
  tds: z.coerce.number().optional(),
  wct: z.coerce.number().optional(),
  lwf: z.coerce.number().optional(),
  other: z.coerce.number().optional(),
  totalAmount: z.coerce.number().optional(),
  salesInvoiceDetails: z.array(salesInvoiceDetailSchema).optional(),
  statusAction: z.enum(["authorize", "unauthorize"]).optional(),
});

// GET /api/sales-invoices/[id] - Get single sales invoice
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sales invoice ID");

    const salesInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        revision: true,
        invoiceDate: true,
        fromDate: true,
        toDate: true,
        siteId: true,
        boqId: true,
        billingAddressId: true,
        grossAmount: true,
        tds: true,
        wct: true,
        lwf: true,
        other: true,
        totalAmount: true,
        authorizedById: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
            siteCode: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            pinCode: true,
            company: {
              select: {
                id: true,
                companyName: true,
                gstNo: true,
              },
            },
          },
        },
        boq: {
          select: {
            id: true,
            workName: true,
            boqNo: true,
          },
        },
        billingAddress: {
          select: {
            id: true,
            companyName: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            pincode: true,
            state: true,
            gstNumber: true,
            email: true,
          },
        },
        authorizedBy: {
          select: {
            id: true,
            name: true,
          },
        },
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
        salesInvoiceDetails: {
          select: {
            id: true,
            boqItemId: true,
            boqItem: {
              select: {
                id: true,
                item: true,
                unit: {
                  select: {
                    id: true,
                    unitName: true,
                  },
                },
              },
            },
            particulars: true,
            totalBoqQty: true,
            invoiceQty: true,
            rate: true,
            discount: true,
            discountAmount: true,
            cgst: true,
            cgstAmt: true,
            sgst: true,
            sgstAmt: true,
            igst: true,
            igstAmt: true,
            amount: true,
          },
        },
      },
    });

    if (!salesInvoice) return NotFound("Sales invoice not found");
    return Success(salesInvoice);
  } catch (error) {
    console.error("Get sales invoice error:", error);
    return ApiError("Failed to fetch sales invoice");
  }
}

// PATCH /api/sales-invoices/[id] - Update sales invoice
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sales invoice ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.salesInvoice.findUnique({
        where: { id },
        select: {
          authorizedById: true,
          createdById: true,
          siteId: true,
          boqId: true,
          invoiceNumber: true,
          revision: true,
          invoiceDate: true,
          fromDate: true,
          toDate: true,
          billingAddressId: true,
          grossAmount: true,
          tds: true,
          wct: true,
          lwf: true,
          other: true,
          totalAmount: true,
        },
      });

      if (!current) {
        throw new Error("BAD_REQUEST: Sales invoice not found");
      }

      const isAuthorized = current.authorizedById !== null;

      const {
        salesInvoiceDetails,
        statusAction,
        ...invoiceData
      } = updateData as any;

      // Handle status actions (authorize/unauthorize)
      if (statusAction) {
        const permSet = new Set((auth.user.permissions || []) as string[]);
        
        if (statusAction === "authorize") {
          if (!permSet.has(PERMISSIONS.AUTHORIZE_SALES_INVOICES)) {
            throw new Error("BAD_REQUEST: Missing permission to authorize sales invoices");
          }
          if (isAuthorized) {
            throw new Error("BAD_REQUEST: Sales invoice is already authorized");
          }
          if (current.createdById === auth.user.id) {
            throw new Error("BAD_REQUEST: Creator cannot authorize their own invoice");
          }
          
          invoiceData.authorizedById = auth.user.id;
        } else if (statusAction === "unauthorize") {
          if (!permSet.has(PERMISSIONS.AUTHORIZE_SALES_INVOICES)) {
            throw new Error("BAD_REQUEST: Missing permission to unauthorize sales invoices");
          }
          if (!isAuthorized) {
            throw new Error("BAD_REQUEST: Sales invoice is not authorized");
          }
          invoiceData.authorizedById = null;
        }
      }

      // Only allow normal edits when not authorized
      if (!statusAction && isAuthorized) {
        throw new Error("BAD_REQUEST: Cannot edit authorized sales invoice");
      }

      // Always update the updatedAt and updatedById
      invoiceData.updatedAt = new Date();
      invoiceData.updatedById = auth.user.id;

      // Update invoice
      await tx.salesInvoice.update({
        where: { id },
        data: invoiceData,
      });

      // Update or create invoice details
      if (salesInvoiceDetails && salesInvoiceDetails.length > 0) {
        // Get existing detail IDs
        const existingDetails = await tx.salesInvoiceDetail.findMany({
          where: { salesInvoiceId: id },
          select: { id: true },
        });

        const existingDetailIds = new Set(existingDetails.map((d) => d.id));
        const updatedDetailIds = new Set<number>();

        // Process each detail
        for (const detail of salesInvoiceDetails) {
          const detailData: any = {
            boqItemId: detail.boqItemId,
            particulars: detail.particulars ?? "",
            totalBoqQty: detail.totalBoqQty,
            invoiceQty: detail.invoiceQty,
            rate: detail.rate,
            discount: detail.discount,
            discountAmount: detail.discountAmount,
            cgst: detail.cgst,
            cgstAmt: detail.cgstAmt,
            sgst: detail.sgst,
            sgstAmt: detail.sgstAmt,
            igst: detail.igst,
            igstAmt: detail.igstAmt,
            amount: detail.amount,
          };

          if (detail.id && existingDetailIds.has(detail.id)) {
            // Update existing detail
            await tx.salesInvoiceDetail.update({
              where: { id: detail.id },
              data: detailData,
            });
            updatedDetailIds.add(detail.id);
          } else {
            // Create new detail
            const newDetail = await tx.salesInvoiceDetail.create({
              data: {
                ...detailData,
                salesInvoiceId: id,
              },
            });
            updatedDetailIds.add(newDetail.id);
          }
        }

        // Delete details that were not included
        const detailsToDelete = existingDetails.filter(
          (detail) => !updatedDetailIds.has(detail.id)
        );
        if (detailsToDelete.length > 0) {
          await tx.salesInvoiceDetail.deleteMany({
            where: {
              id: { in: detailsToDelete.map((d) => d.id) },
            },
          });
        }
      }

      // Create log entry
      const logType = statusAction === "authorize" ? "AUTHORIZE" : 
                      statusAction === "unauthorize" ? "UPDATE" : "UPDATE";
      
      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });
      
      // Create the main log entry
      const salesInvoiceLog = await tx.salesInvoiceLog.create({
        data: {
          salesInvoiceId: id,
          siteId: current.siteId,
          logType: logType as any,
          boqId: current.boqId,
          invoiceNumber: current.invoiceNumber,
          revision: current.revision,
          invoiceDate: current.invoiceDate,
          fromDate: current.fromDate,
          toDate: current.toDate,
          billingAddressId: current.billingAddressId,
          grossAmount: invoiceData.grossAmount ?? current.grossAmount,
          tds: invoiceData.tds ?? current.tds,
          wct: invoiceData.wct ?? current.wct,
          lwf: invoiceData.lwf ?? current.lwf,
          other: invoiceData.other ?? current.other,
          totalAmount: invoiceData.totalAmount ?? current.totalAmount,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Create detail logs from the updated invoice details
      const updatedDetails = await tx.salesInvoiceDetail.findMany({
        where: { salesInvoiceId: id },
      });

      const detailLogsData = updatedDetails.map((detail) => ({
        salesInvoiceLogId: salesInvoiceLog.id,
        salesInvoiceDetailId: detail.id,
        boqItemId: detail.boqItemId,
        particulars: detail.particulars ?? "",
        totalBoqQty: detail.totalBoqQty,
        invoiceQty: detail.invoiceQty,
        rate: detail.rate,
        discount: detail.discount,
        discountAmount: detail.discountAmount,
        cgst: detail.cgst,
        cgstAmt: detail.cgstAmt,
        sgst: detail.sgst,
        sgstAmt: detail.sgstAmt,
        igst: detail.igst,
        igstAmt: detail.igstAmt,
        amount: detail.amount,
      }));

      if (detailLogsData.length > 0) {
        await tx.salesInvoiceDetailLog.createMany({
          data: detailLogsData,
        });
      }

      // Return updated invoice
      const updatedInvoice = await tx.salesInvoice.findUnique({
        where: { id },
        select: {
          id: true,
          invoiceNumber: true,
          revision: true,
          invoiceDate: true,
          fromDate: true,
          toDate: true,
          siteId: true,
          boqId: true,
          billingAddressId: true,
          grossAmount: true,
          tds: true,
          wct: true,
          lwf: true,
          other: true,
          totalAmount: true,
          authorizedById: true,
          createdById: true,
          updatedById: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          boq: {
            select: {
              id: true,
              workName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
            },
          },
          authorizedBy: {
            select: {
              id: true,
              name: true,
            },
          },
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
          salesInvoiceDetails: {
            select: {
              id: true,
              boqItemId: true,
              boqItem: {
                select: {
                  id: true,
                  item: true,
                  unit: {
                    select: {
                      id: true,
                      unitName: true,
                    },
                  },
                },
              },
              particulars: true,
              totalBoqQty: true,
              invoiceQty: true,
              rate: true,
              discount: true,
              discountAmount: true,
              cgst: true,
              cgstAmt: true,
              sgst: true,
              sgstAmt: true,
              igst: true,
              igstAmt: true,
              amount: true,
            },
          },
        },
      });

      return updatedInvoice;
    });

    return Success(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
      return BadRequest(error.message.replace(/^BAD_REQUEST:\s*/i, ""));
    }
    console.error("Update sales invoice error:", error);
    return ApiError("Failed to update sales invoice");
  }
}

// DELETE /api/sales-invoices/[id] - Delete sales invoice
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sales invoice ID");

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      select: {
        authorizedById: true,
        invoiceNumber: true,
        siteId: true,
        boqId: true,
        invoiceDate: true,
        fromDate: true,
        toDate: true,
        billingAddressId: true,
        grossAmount: true,
        tds: true,
        wct: true,
        lwf: true,
        other: true,
        totalAmount: true,
      },
    });

    if (!invoice) {
      return NotFound("Sales invoice not found");
    }

    if (invoice.authorizedById !== null) {
      return BadRequest("Cannot delete authorized sales invoice");
    }

    await prisma.$transaction(async (tx) => {
      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });

      // Fetch invoice details before deleting for the log
      const invoiceDetails = await tx.salesInvoiceDetail.findMany({
        where: { salesInvoiceId: id },
      });

      // Create delete log
      const salesInvoiceLog = await tx.salesInvoiceLog.create({
        data: {
          salesInvoiceId: id,
          siteId: invoice.siteId,
          logType: "DELETE",
          boqId: invoice.boqId,
          invoiceNumber: invoice.invoiceNumber,
          revision: "00",
          invoiceDate: invoice.invoiceDate,
          fromDate: invoice.fromDate,
          toDate: invoice.toDate,
          billingAddressId: invoice.billingAddressId,
          grossAmount: invoice.grossAmount,
          tds: invoice.tds,
          wct: invoice.wct,
          lwf: invoice.lwf,
          other: invoice.other,
          totalAmount: invoice.totalAmount,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Create detail logs
      const detailLogsData = invoiceDetails.map((detail) => ({
        salesInvoiceLogId: salesInvoiceLog.id,
        salesInvoiceDetailId: detail.id,
        boqItemId: detail.boqItemId,
        particulars: detail.particulars ?? "",
        totalBoqQty: detail.totalBoqQty,
        invoiceQty: detail.invoiceQty,
        rate: detail.rate,
        discount: detail.discount,
        discountAmount: detail.discountAmount,
        cgst: detail.cgst,
        cgstAmt: detail.cgstAmt,
        sgst: detail.sgst,
        sgstAmt: detail.sgstAmt,
        igst: detail.igst,
        igstAmt: detail.igstAmt,
        amount: detail.amount,
      }));

      if (detailLogsData.length > 0) {
        await tx.salesInvoiceDetailLog.createMany({
          data: detailLogsData,
        });
      }

      // Delete details first
      await tx.salesInvoiceDetail.deleteMany({
        where: { salesInvoiceId: id },
      });

      // Delete invoice
      await tx.salesInvoice.delete({
        where: { id },
      });
    });

    return Success({ message: "Sales invoice deleted successfully" });
  } catch (error) {
    console.error("Delete sales invoice error:", error);
    return ApiError("Failed to delete sales invoice");
  }
}
