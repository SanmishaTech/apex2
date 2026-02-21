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
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const updateSchema = z.object({
  purchaseOrderId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  siteId: z.number().int().positive().optional(),
  inwardChallanNo: z.string().min(1).max(50).optional(),
  inwardChallanDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid inward challan date",
    })
    .optional(),
  challanNo: z.string().min(1).max(100).optional(),
  challanDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid challan date",
    })
    .optional(),
  lrNo: z.string().max(100).optional().nullable(),
  lRDate: z
    .string()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Invalid LR date",
    })
    .optional()
    .nullable(),
  billNo: z.string().max(100).optional().nullable(),
  billDate: z
    .string()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Invalid bill date",
    })
    .optional()
    .nullable(),
  vehicleNo: z.string().max(50).optional().nullable(),
  remarks: z.string().max(255).optional().nullable(),

  // updatedById is set from auth on the server
  inwardDeliveryChallanDetails: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        poDetailsId: z.number().int().positive("PO Details ID is required"),
        receivingQty: z.number().min(0).default(0),
        idcDetailBatches: z
          .array(
            z.object({
              batchNumber: z.string().min(1, "Batch number is required"),
              expiryDate: z
                .string()
                .min(1, "Expiry date is required")
                .regex(/^\d{4}-\d{2}$/, "Expiry date must be in YYYY-MM format"),
              receivingQty: z.number().min(0).default(0),
            })
          )
          .optional(),
        rate: z.number().min(0).default(0),
        amount: z.number().min(0).default(0),
      })
    )
    .optional(),
});

// GET /api/inward-delivery-challans/[id] - Get single inward delivery challan
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid inward delivery challan ID");

    const challan = await prisma.inwardDeliveryChallan.findUnique({
      where: { id },
      select: {
        id: true,
        purchaseOrderId: true,
        vendorId: true,
        siteId: true,
        inwardChallanNo: true,
        inwardChallanDate: true,
        challanNo: true,
        challanDate: true,
        lrNo: true,
        lRDate: true,
        billNo: true,
        billDate: true,
        billAmount: true,
        dueDays: true,
        dueDate: true,
        dueAmount: true,
        totalPaidAmount: true,
        status: true,
        vehicleNo: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        purchaseOrder: {
          select: {
            id: true,
            purchaseOrderNo: true,
          },
        },
        vendor: {
          select: {
            id: true,
            vendorName: true,
          },
        },
        site: {
          select: {
            id: true,
            site: true,
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
        inwardDeliveryChallanDetails: {
          select: {
            id: true,
            poDetailsId: true,
            receivingQty: true,
            rate: true,
            amount: true,
            poDetails: {
              select: {
                id: true,
                itemId: true,
                qty: true,
                rate: true,
                amount: true,
                item: {
                  select: {
                    id: true,
                    item: true,
                    itemCode: true,
                    unit: {
                      select: {
                        id: true,
                        unitName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        inwardDeliveryChallanDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      },
    });

    if (!challan) return NotFound("Inward delivery challan not found");

    // Compute closing stock per item for this site using SiteItem.closingStock
    try {
      const itemIds = (challan.inwardDeliveryChallanDetails || [])
        .map((d: any) => d?.poDetails?.itemId)
        .filter((v: any) => typeof v === "number");
      const uniqueItemIds = Array.from(new Set(itemIds));
      let closingStockByItemId: Record<number, number> = {};
      if (uniqueItemIds.length > 0) {
        const siteItems = await prisma.siteItem.findMany({
          where: { siteId: challan.siteId, itemId: { in: uniqueItemIds } },
          select: { itemId: true, closingStock: true },
        });
        for (const si of siteItems) {
          closingStockByItemId[Number(si.itemId)] = Number(si.closingStock ?? 0);
        }
      }
      return Success({ ...challan, closingStockByItemId });
    } catch (e) {
      // If stock computation fails, still return challan
      return Success(challan);
    }
  } catch (error) {
    console.error("Get inward delivery challan error:", error);
    return ApiError("Failed to fetch inward delivery challan");
  }
}

// PATCH /api/inward-delivery-challans/[id] - Update inward delivery challan
async function saveInwardDeliveryChallanDoc(
  file: File | null,
  subname: string
) {
  if (!file || file.size === 0) return null;
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type || ""))
    throw new Error("Unsupported file type");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("File too large (max 20MB)");
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-inward-delivery-challan-doc-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "inward-delivery-challans");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/inward-delivery-challans/${filename}`;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid inward delivery challan ID");

    const contentType = req.headers.get("content-type") || "";
    let challanData: Record<string, unknown>;
    let inwardDeliveryChallanDocumentFiles: Array<{
      index: number;
      file: File;
    }> = [];
    let documentMetadata: Array<{
      id?: number;
      documentName?: string;
      documentUrl?: string;
      index: number;
    }> = [];
    let documentsProvided = false;

    // Handle multipart form data for file uploads
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      // Extract other form data
      challanData = {
        purchaseOrderId: form.get("purchaseOrderId")
          ? Number(form.get("purchaseOrderId"))
          : undefined,
        vendorId: form.get("vendorId")
          ? Number(form.get("vendorId"))
          : undefined,
        siteId: form.get("siteId") ? Number(form.get("siteId")) : undefined,
        inwardChallanNo: form.get("inwardChallanNo") || undefined,
        inwardChallanDate: form.get("inwardChallanDate") || undefined,
        challanNo: form.get("challanNo") || undefined,
        challanDate: form.get("challanDate") || undefined,
        lrNo: form.get("lrNo") || null,
        lRDate: form.get("lRDate") || null,
        billNo: form.get("billNo") || null,
        billDate: form.get("billDate") || null,
        vehicleNo: form.get("vehicleNo") || null,
        remarks: form.get("remarks") || null,
        updatedById: form.get("updatedById")
          ? Number(form.get("updatedById"))
          : undefined,
      };

      // Parse inwardDeliveryChallanDetails
      const detailsJson = form.get("inwardDeliveryChallanDetails");
      if (typeof detailsJson === "string" && detailsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(detailsJson);
          if (Array.isArray(parsed)) {
            challanData.inwardDeliveryChallanDetails = parsed;
          }
        } catch (e) {
          console.warn(
            "Failed to parse inwardDeliveryChallanDetails (PATCH)",
            e
          );
        }
      }

      // Documents payload
      documentsProvided = form.has("inwardDeliveryChallanDocuments");
      const documentsJson = form.get("inwardDeliveryChallanDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            documentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === "object")
              .map((doc: any, index: number) => ({
                id:
                  typeof doc.id === "number" && Number.isFinite(doc.id)
                    ? doc.id
                    : undefined,
                documentName:
                  typeof doc.documentName === "string"
                    ? doc.documentName
                    : undefined,
                documentUrl:
                  typeof doc.documentUrl === "string"
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (e) {
          console.warn(
            "Failed to parse inwardDeliveryChallanDocuments metadata (PATCH)",
            e
          );
        }
      }

      form.forEach((value, key) => {
        const match = key.match(
          /^inwardDeliveryChallanDocuments\[(\d+)\]\[documentFile\]$/
        );
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File)
          inwardDeliveryChallanDocumentFiles.push({
            index: idx,
            file: fileVal,
          });
      });

      // Remove undefined values for partial updates
      Object.keys(challanData).forEach((key) => {
        if (challanData[key] === undefined) {
          delete challanData[key];
        }
      });
    } else {
      // Handle JSON data
      challanData = await req.json();
      documentsProvided = Object.prototype.hasOwnProperty.call(
        challanData ?? {},
        "inwardDeliveryChallanDocuments"
      );
      documentMetadata = Array.isArray(
        (challanData as any)?.inwardDeliveryChallanDocuments
      )
        ? (challanData as any).inwardDeliveryChallanDocuments.map(
            (doc: any, index: number) => ({
              id:
                typeof doc?.id === "number" && Number.isFinite(doc.id)
                  ? doc.id
                  : undefined,
              documentName:
                typeof doc?.documentName === "string"
                  ? doc.documentName
                  : undefined,
              documentUrl:
                typeof doc?.documentUrl === "string"
                  ? doc.documentUrl
                  : undefined,
              index,
            })
          )
        : [];
    }

    // Validate incoming strings first
    const validatedData = updateSchema.parse(challanData);

    // Extract details for separate handling
    const { inwardDeliveryChallanDetails, ...challanUpdateData } =
      validatedData;

    // Map foreign key ids to relation connects to satisfy Prisma typed input
    const { purchaseOrderId, vendorId, siteId, ...rest } =
      challanUpdateData as any;
    // Convert date strings to Date objects for Prisma
    const dateFieldsToConvert = [
      "inwardChallanDate",
      "challanDate",
      "lRDate",
      "billDate",
    ];
    const restWithDates: any = { ...rest };
    dateFieldsToConvert.forEach((f) => {
      if (restWithDates[f] && typeof restWithDates[f] === "string") {
        restWithDates[f] = new Date(restWithDates[f]);
      }
    });
    const updateData: any = {
      ...restWithDates,
      ...(purchaseOrderId
        ? { purchaseOrder: { connect: { id: purchaseOrderId as number } } }
        : {}),
      ...(vendorId ? { vendor: { connect: { id: vendorId as number } } } : {}),
      ...(siteId ? { site: { connect: { id: siteId as number } } } : {}),
    };

    // Use transaction to handle both challan and details updates
    const result = await prisma.$transaction(async (tx) => {
      // Update the main challan record
      const updated = await tx.inwardDeliveryChallan.update({
        where: { id },
        data: {
          ...updateData,
          updatedBy: { connect: { id: (auth as any).user?.id as number } },
        },
        select: {
          id: true,
          purchaseOrderId: true,
          vendorId: true,
          siteId: true,
          inwardChallanNo: true,
          inwardChallanDate: true,
          challanNo: true,
          challanDate: true,
          lrNo: true,
          lRDate: true,
          billNo: true,
          billDate: true,
          vehicleNo: true,
          remarks: true,
          updatedAt: true,
          purchaseOrder: {
            select: {
              id: true,
              purchaseOrderNo: true,
            },
          },
          vendor: {
            select: {
              id: true,
              vendorName: true,
            },
          },
          site: {
            select: {
              id: true,
              site: true,
            },
          },
        },
      });

      // Handle inward delivery challan details if provided
      if (
        inwardDeliveryChallanDetails &&
        Array.isArray(inwardDeliveryChallanDetails)
      ) {
        const filteredDetails = (inwardDeliveryChallanDetails as any[]).filter(
          (d: any) => Number(d?.receivingQty ?? 0) > 0
        );

        // Fetch existing details to rollback PO receivedQty before applying new ones
        const existingDetails = await tx.inwardDeliveryChallanDetail.findMany({
          where: { inwardDeliveryChallanId: id },
          select: { id: true, poDetailsId: true, receivingQty: true },
        });

        // Rollback existing batch impacts (if any)
        const existingDetailIds = existingDetails
          .map((d) => d.id)
          .filter((v): v is number => typeof v === "number");
        if (existingDetailIds.length > 0) {
          const oldBatches = await tx.inwardDeliveryChallanDetailBatch.findMany({
            where: { inwardDeliveryChallanDetailId: { in: existingDetailIds } },
            select: {
              inwardDeliveryChallanDetailId: true,
              batchNumber: true,
              expiryDate: true,
              qty: true,
              amount: true,
            },
          });

          // Map detailId -> poDetailsId -> itemId
          const poDetailsIds = existingDetails
            .map((d) => Number(d.poDetailsId))
            .filter((v) => Number.isFinite(v));
          const poDetails = poDetailsIds.length
            ? await tx.purchaseOrderDetail.findMany({
                where: { id: { in: poDetailsIds } },
                select: { id: true, itemId: true },
              })
            : [];
          const itemIdByPoDetailsId = new Map<number, number>(
            poDetails.map((d) => [Number(d.id), Number(d.itemId)])
          );
          const poDetailsIdByDetailId = new Map<number, number>(
            existingDetails.map((d) => [Number(d.id), Number(d.poDetailsId)])
          );

          for (const ob of oldBatches) {
            const poDetailsId = poDetailsIdByDetailId.get(
              Number(ob.inwardDeliveryChallanDetailId)
            );
            const itemId = poDetailsId ? itemIdByPoDetailsId.get(poDetailsId) : undefined;
            if (!itemId) continue;

            const siteItem = await tx.siteItem.findFirst({
              where: { siteId: updated.siteId, itemId },
              select: { id: true },
            });
            if (!siteItem?.id) continue;

            const sib = await tx.siteItemBatch.findFirst({
              where: {
                siteItemId: siteItem.id,
                batchNumber: String(ob.batchNumber),
              },
              select: { id: true, closingQty: true, closingValue: true },
            });
            if (!sib) continue;

            const prevQty = Number(sib.closingQty || 0);
            const prevVal = Number(sib.closingValue || 0);
            const decQty = Number(ob.qty || 0);
            const decVal = Number(ob.amount || 0);
            const nextQty = Math.max(0, Number((prevQty - decQty).toFixed(2)));
            const nextVal = Math.max(0, Number((prevVal - decVal).toFixed(2)));
            const nextRate = nextQty > 0 ? Number((nextVal / nextQty).toFixed(2)) : 0;

            await tx.siteItemBatch.update({
              where: { id: sib.id },
              data: {
                closingQty: nextQty as any,
                closingValue: nextVal as any,
                unitRate: nextRate as any,
              } as any,
            });
          }

          // Delete old batches (details will be deleted below)
          await tx.inwardDeliveryChallanDetailBatch.deleteMany({
            where: { inwardDeliveryChallanDetailId: { in: existingDetailIds } },
          });
        }

        const existingByPoDetailsId = new Map<number, number>();
        for (const d of existingDetails) {
          const poDetailsId = Number(d.poDetailsId);
          const qty = Number(d.receivingQty ?? 0);
          if (!Number.isFinite(poDetailsId) || poDetailsId <= 0) continue;
          if (!Number.isFinite(qty) || qty <= 0) continue;
          existingByPoDetailsId.set(
            poDetailsId,
            Number(((existingByPoDetailsId.get(poDetailsId) || 0) + qty).toFixed(4))
          );
        }

        // Rollback existing receivedQty on PO details
        for (const [poDetailsId, qty] of existingByPoDetailsId.entries()) {
          await tx.purchaseOrderDetail.update({
            where: { id: poDetailsId },
            data: { receivedQty: { decrement: qty } },
          });
        }

        // Validate new totals against remaining after rollback
        const incomingByPoDetailsId = new Map<number, number>();
        for (const detail of filteredDetails as any[]) {
          const poDetailsId = Number(detail?.poDetailsId);
          if (!Number.isFinite(poDetailsId) || poDetailsId <= 0) continue;
          const qty = Number(detail?.receivingQty ?? 0);
          if (!Number.isFinite(qty) || qty < 0) continue;
          if (qty <= 0) continue;
          incomingByPoDetailsId.set(
            poDetailsId,
            Number(((incomingByPoDetailsId.get(poDetailsId) || 0) + qty).toFixed(4))
          );
        }

        const validateIds = Array.from(incomingByPoDetailsId.keys());
        if (validateIds.length > 0) {
          const poDetails = await tx.purchaseOrderDetail.findMany({
            where: { id: { in: validateIds } },
            select: { id: true, qty: true, receivedQty: true },
          });

          const poQtyById = new Map<number, number>(
            poDetails.map((d: any) => [Number(d.id), Number(d.qty ?? 0)])
          );
          const alreadyReceivedById = new Map<number, number>(
            poDetails.map((d: any) => [Number(d.id), Number(d.receivedQty ?? 0)])
          );

          for (const [poDetailsId, incomingQty] of incomingByPoDetailsId.entries()) {
            const poQty = poQtyById.get(poDetailsId) ?? 0;
            const alreadyReceived = alreadyReceivedById.get(poDetailsId) ?? 0;
            const remaining = Number((poQty - alreadyReceived).toFixed(4));
            if (incomingQty > remaining + 1e-9) {
              throw new Error(
                `Receiving qty exceeds remaining qty for PO item (PO Detail ID: ${poDetailsId}). Remaining: ${Number(remaining.toFixed(2))}`
              );
            }
          }
        }

        // Delete existing details
        await tx.inwardDeliveryChallanDetail.deleteMany({
          where: { inwardDeliveryChallanId: id },
        });

        // Create new details
        if (filteredDetails.length > 0) {
          const createdDetails: Array<{ id: number; poDetailsId: number; rate: number }> = [];
          for (const detail of filteredDetails as any[]) {
            const row = await tx.inwardDeliveryChallanDetail.create({
              data: {
                inwardDeliveryChallanId: id,
                poDetailsId: detail.poDetailsId,
                receivingQty: detail.receivingQty,
                rate: detail.rate,
                amount: detail.amount,
              },
              select: { id: true, poDetailsId: true, rate: true },
            });
            createdDetails.push({
              id: row.id,
              poDetailsId: Number(row.poDetailsId),
              rate: Number(row.rate || 0),
            });
          }

          // Apply new batch impacts
          if (createdDetails.length > 0) {
            const poDetailsIds = createdDetails.map((d) => d.poDetailsId);
            const poDetails = await tx.purchaseOrderDetail.findMany({
              where: { id: { in: poDetailsIds } },
              select: { id: true, itemId: true, item: { select: { isExpiryDate: true } } },
            });
            const itemIdByPoDetailsId = new Map<number, number>(
              poDetails.map((d) => [Number(d.id), Number(d.itemId)])
            );
            const isExpiryByPoDetailsId = new Map<number, boolean>(
              poDetails.map((d) => [Number(d.id), Boolean(d.item?.isExpiryDate)])
            );

            for (const det of createdDetails) {
              const isExpiry = isExpiryByPoDetailsId.get(det.poDetailsId);
              if (!isExpiry) continue;
              const itemId = itemIdByPoDetailsId.get(det.poDetailsId);
              if (!itemId) continue;

              const batches = Array.isArray(
                (filteredDetails as any[]).find((x) => Number(x?.poDetailsId) === det.poDetailsId)
                  ?.idcDetailBatches
              )
                ? ((filteredDetails as any[]).find(
                    (x) => Number(x?.poDetailsId) === det.poDetailsId
                  )?.idcDetailBatches as any[])
                : [];

              const cleaned = batches
                .map((b) => ({
                  batchNumber: String(b?.batchNumber || "").trim(),
                  expiryDate: String(b?.expiryDate || "").trim(),
                  receivingQty: Number(b?.receivingQty ?? 0),
                }))
                .filter(
                  (b) =>
                    !!b.batchNumber &&
                    /^\d{4}-\d{2}$/.test(b.expiryDate) &&
                    Number.isFinite(b.receivingQty) &&
                    b.receivingQty > 0
                );
              if (cleaned.length === 0) continue;

              const siteItem = await tx.siteItem.findFirst({
                where: { siteId: updated.siteId, itemId },
                select: { id: true },
              });
              const siteItemId = siteItem?.id
                ? siteItem.id
                : (
                    await tx.siteItem.create({
                      data: { siteId: updated.siteId, itemId, log: "IDC Batch" } as any,
                      select: { id: true },
                    })
                  ).id;

              for (const b of cleaned) {
                const existingBatch = await tx.siteItemBatch.findFirst({
                  where: { siteItemId, batchNumber: b.batchNumber },
                  select: { id: true, expiryDate: true, closingQty: true, closingValue: true },
                });
                if (existingBatch && String(existingBatch.expiryDate || "") !== b.expiryDate) {
                  throw new Error(
                    `Expiry date mismatch for batch ${b.batchNumber}. Expected ${existingBatch.expiryDate}`
                  );
                }

                const amount = Number((det.rate * Number(b.receivingQty || 0)).toFixed(2));
                await tx.inwardDeliveryChallanDetailBatch.create({
                  data: {
                    inwardDeliveryChallanDetailId: det.id,
                    batchNumber: b.batchNumber,
                    expiryDate: b.expiryDate,
                    qty: b.receivingQty as any,
                    unitRate: det.rate as any,
                    amount: amount as any,
                  } as any,
                });

                if (!existingBatch) {
                  await tx.siteItemBatch.create({
                    data: {
                      siteItemId,
                      siteId: updated.siteId,
                      itemId,
                      batchNumber: b.batchNumber,
                      expiryDate: b.expiryDate,
                      closingQty: b.receivingQty as any,
                      closingValue: amount as any,
                      unitRate: det.rate as any,
                    } as any,
                  });
                } else {
                  const prevQty = Number(existingBatch.closingQty || 0);
                  const prevVal = Number(existingBatch.closingValue || 0);
                  const nextQty = Number((prevQty + Number(b.receivingQty || 0)).toFixed(2));
                  const nextVal = Number((prevVal + amount).toFixed(2));
                  const nextRate = nextQty > 0 ? Number((nextVal / nextQty).toFixed(2)) : 0;
                  await tx.siteItemBatch.update({
                    where: { id: existingBatch.id },
                    data: {
                      closingQty: nextQty as any,
                      closingValue: nextVal as any,
                      unitRate: nextRate as any,
                    } as any,
                  });
                }
              }
            }
          }

          // Apply new receivedQty on PO details
          for (const [poDetailsId, qty] of incomingByPoDetailsId.entries()) {
            if (!Number.isFinite(qty) || qty <= 0) continue;
            await tx.purchaseOrderDetail.update({
              where: { id: poDetailsId },
              data: { receivedQty: { increment: qty } },
            });
          }
        }
      }

      return updated;
    });

    // Handle document updates if provided
    if (documentsProvided) {
      const filesByIndex = new Map<number, File>();
      inwardDeliveryChallanDocumentFiles.forEach(({ index, file }) =>
        filesByIndex.set(index, file)
      );

      // Get existing documents to potentially delete
      const existingDocs = await prisma.inwardDeliveryChallanDocuments.findMany(
        {
          where: { inwardDeliveryChallanId: id },
          select: { id: true, documentUrl: true },
        }
      );

      // Delete all existing documents
      await prisma.inwardDeliveryChallanDocuments.deleteMany({
        where: { inwardDeliveryChallanId: id },
      });

      // Delete physical files
      for (const doc of existingDocs) {
        if (doc.documentUrl.startsWith("/uploads/inward-delivery-challans/")) {
          const filePath = path.join(process.cwd(), doc.documentUrl);
          try {
            await fs.unlink(filePath);
          } catch (e) {
            console.warn("Failed to delete file:", filePath, e);
          }
        }
      }

      // Create new documents
      const createPayload: Array<{
        inwardDeliveryChallanId: number;
        documentName: string;
        documentUrl: string;
      }> = [];

      for (const docMeta of documentMetadata) {
        const name = (docMeta.documentName || "").trim();
        const file = filesByIndex.get(docMeta.index ?? -1);
        const trimmedUrl = docMeta.documentUrl?.trim();
        let finalUrl =
          trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;

        if (file) {
          const saved = await saveInwardDeliveryChallanDoc(file, "doc");
          finalUrl = saved ?? undefined;
        }

        if (!name || !finalUrl) continue;
        createPayload.push({
          inwardDeliveryChallanId: id,
          documentName: name,
          documentUrl: finalUrl,
        });
      }

      if (createPayload.length > 0) {
        await prisma.inwardDeliveryChallanDocuments.createMany({
          data: createPayload,
        });
      }
    }

    return Success(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NotFound("Inward delivery challan not found");
    }
    console.error("Update inward delivery challan error:", error);
    return ApiError("Failed to update inward delivery challan");
  }
}
