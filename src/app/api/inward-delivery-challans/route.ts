import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
async function generateInwardChallanNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const candidates = await tx.inwardDeliveryChallan.findMany({
    where: {
      inwardChallanNo: {
        contains: "-",
      },
    },
    orderBy: { inwardChallanNo: "desc" },
    select: { inwardChallanNo: true },
    take: 50,
  });
  const latest = candidates.find((c) =>
    /^\d{4}-\d{4}$/.test(c.inwardChallanNo)
  );

  let left = 1;
  let right = 1;

  if (latest?.inwardChallanNo) {
    const parts = latest.inwardChallanNo.split("-");
    if (parts.length === 2) {
      const prevLeft = parseInt(parts[0], 10);
      const prevRight = parseInt(parts[1], 10);
      if (Number.isFinite(prevLeft) && Number.isFinite(prevRight)) {
        left = prevLeft;
        right = prevRight + 1;
        if (right > 9999) {
          left = left + 1;
          right = 1;
        }
      }
    }
  }

  const leftStr = String(left).padStart(4, "0");
  const rightStr = String(right).padStart(4, "0");
  return `${leftStr}-${rightStr}`;
}

const createSchema = z.object({
  purchaseOrderId: z.number().int().positive("Purchase Order ID is required"),
  vendorId: z.number().int().positive("Vendor ID is required"),
  siteId: z.number().int().positive("Site ID is required"),
  inwardChallanNo: z.string().max(50).optional(),
  inwardChallanDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid inward challan date",
  }),
  challanNo: z.string().min(1, "Challan No is required").max(100),
  challanDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid challan date",
  }),
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
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid bill date",
    })
    .optional()
    .nullable(),
  vehicleNo: z.string().max(50).optional().nullable(),
  remarks: z.string().max(255).optional().nullable(),

  // createdById and updatedById will be injected from auth user on the server
  inwardDeliveryChallanDetails: z
    .array(
      z.object({
        poDetailsId: z.number().int().positive("PO Details ID is required"),
        receivingQty: z.number().min(0).default(0),
      })
    )
    .optional(),
});

// GET /api/inward-delivery-challans?search=&status=UNPAID&page=1&perPage=10&sort=inwardChallanNo&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant");
  if (variant === "dropdown") {
    return handleDropdown(req);
  }
  if (variant === "closing-stock") {
    // Compute closing stock for a site and a list of itemIds
    const siteIdParam = searchParams.get("siteId");
    const itemIdsParam = searchParams.get("itemIds");
    const siteId = siteIdParam ? Number(siteIdParam) : NaN;
    const itemIds = (itemIdsParam || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (!Number.isFinite(siteId) || itemIds.length === 0) {
      return BadRequest("siteId and itemIds are required");
    }
    try {
      const sums = await prisma.stockLedger.groupBy({
        by: ["itemId"],
        where: {
          siteId: siteId as number,
          itemId: { in: itemIds as number[] },
        },
        _sum: { receivedQty: true, issuedQty: true },
      } as any);
      const closingStockByItemId: Record<number, number> = {};
      for (const row of sums as any[]) {
        const recv = Number(row._sum?.receivedQty ?? 0);
        const issued = Number(row._sum?.issuedQty ?? 0);
        closingStockByItemId[row.itemId] = Number((recv - issued).toFixed(4));
      }
      return Success({ closingStockByItemId });
    } catch (e) {
      return ApiError("Failed to compute closing stock");
    }
  }

  try {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const statusParam = searchParams.get("status");
    const sort = (searchParams.get("sort") || "inwardChallanNo") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    // Build dynamic filter
    type InwardDeliveryChallanWhere = {
      OR?: Array<{
        inwardChallanNo?: { contains: string };
        challanNo?: { contains: string };
        billNo?: { contains: string };
        vendor?: { vendorName?: { contains: string } };
        site?: { site?: { contains: string } };
      }>;
      vendorId?: number;
      siteId?: number;
      purchaseOrderId?: number;
    };
    const where: InwardDeliveryChallanWhere = {};

    if (search) {
      where.OR = [
        { inwardChallanNo: { contains: search } },
        { challanNo: { contains: search } },
        { billNo: { contains: search } },
        { vendor: { vendorName: { contains: search } } },
        { site: { site: { contains: search } } },
      ];
    }

    const vendorIdParam = searchParams.get("vendorId");
    if (vendorIdParam && !isNaN(Number(vendorIdParam))) {
      where.vendorId = Number(vendorIdParam);
    }

    const siteIdParam = searchParams.get("siteId");
    if (siteIdParam && !isNaN(Number(siteIdParam))) {
      where.siteId = Number(siteIdParam);
    }

    const purchaseOrderIdParam = searchParams.get("purchaseOrderId");
    if (purchaseOrderIdParam && !isNaN(Number(purchaseOrderIdParam))) {
      where.purchaseOrderId = Number(purchaseOrderIdParam);
    }

    // Allow listed sortable fields only
    const sortableFields = new Set([
      "inwardChallanNo",
      "inwardChallanDate",
      "challanNo",
      "challanDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { inwardChallanNo: "asc" };

    const result = await paginate({
      model: prisma.inwardDeliveryChallan as any,
      where,
      orderBy,
      page,
      perPage,
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
        dueDate: true,
        billAmount: true,
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
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get inward delivery challans error:", error);
    return ApiError("Failed to fetch inward delivery challans");
  }
}

// Helper to support lightweight dropdown lists without pagination metadata
async function handleDropdown(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const perPage = Math.min(
    1000,
    Math.max(1, Number(searchParams.get("perPage")) || 1000)
  );
  const search = searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { inwardChallanNo: { contains: search } },
          { challanNo: { contains: search } },
        ],
      }
    : undefined;

  const challans = await prisma.inwardDeliveryChallan.findMany({
    where,
    select: {
      id: true,
      inwardChallanNo: true,
      challanNo: true,
    },
    orderBy: { inwardChallanNo: "asc" },
    take: perPage,
  });

  return Success({ data: challans });
}

// POST /api/inward-delivery-challans - Create new inward delivery challan
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    let challanData: Record<string, unknown>;
    let inwardDeliveryChallanDocumentMetadata: Array<{
      id?: number;
      documentName: string;
      documentUrl?: string;
      index: number;
    }> = [];
    const inwardDeliveryChallanDocumentFiles: Array<{
      index: number;
      file: File;
    }> = [];

    const saveInwardDeliveryChallanDoc = async (
      file: File | null,
      subname: string
    ) => {
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
      const dir = path.join(
        process.cwd(),
        "uploads",
        "inward-delivery-challans"
      );
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await file.arrayBuffer())
      );
      return `/uploads/inward-delivery-challans/${filename}`;
    };

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
        inwardChallanNo: (() => {
          const v = form.get("inwardChallanNo");
          return typeof v === "string" && v.trim().length > 0 ? v : undefined;
        })(),
        inwardChallanDate: form.get("inwardChallanDate"),
        challanNo: form.get("challanNo"),
        challanDate: form.get("challanDate"),
        lrNo: form.get("lrNo") || null,
        lRDate: form.get("lRDate") || null,
        billNo: form.get("billNo") || null,
        billDate: form.get("billDate") || null,
        vehicleNo: form.get("vehicleNo") || null,
        remarks: form.get("remarks") || null,
        createdById: form.get("createdById")
          ? Number(form.get("createdById"))
          : undefined,
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
            "Failed to parse inwardDeliveryChallanDetails (POST)",
            e
          );
        }
      }

      // Parse inwardDeliveryChallanDocuments metadata
      const documentsJson = form.get("inwardDeliveryChallanDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            inwardDeliveryChallanDocumentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === "object")
              .map((doc: any, index: number) => ({
                id:
                  typeof doc.id === "number" && Number.isFinite(doc.id)
                    ? doc.id
                    : undefined,
                documentName: String(doc.documentName || ""),
                documentUrl:
                  typeof doc.documentUrl === "string" &&
                  doc.documentUrl.trim() !== ""
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (e) {
          console.warn(
            "Failed to parse inwardDeliveryChallanDocuments metadata (POST)",
            e
          );
        }
      }

      // Collect indexed files inwardDeliveryChallanDocuments[n][documentFile]
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
    } else {
      // Handle JSON data
      challanData = await req.json();
      inwardDeliveryChallanDocumentMetadata = Array.isArray(
        (challanData as any)?.inwardDeliveryChallanDocuments
      )
        ? (challanData as any).inwardDeliveryChallanDocuments.map(
            (doc: any, index: number) => ({
              id:
                typeof doc?.id === "number" && Number.isFinite(doc.id)
                  ? doc.id
                  : undefined,
              documentName: String(doc?.documentName || ""),
              documentUrl:
                typeof doc?.documentUrl === "string" &&
                doc.documentUrl.trim() !== ""
                  ? doc.documentUrl
                  : undefined,
              index,
            })
          )
        : [];
    }

    // First validate incoming strings
    const validatedData = createSchema.parse(challanData);

    const created = await prisma.$transaction(async (tx) => {
      const { inwardDeliveryChallanDetails, ...challanCreateData } =
        validatedData as any;

      const { purchaseOrderId, vendorId, siteId, inwardChallanNo, ...rest } =
        challanCreateData as any;

      const finalInwardChallanNo =
        typeof inwardChallanNo === "string" && inwardChallanNo.trim().length > 0
          ? inwardChallanNo.trim()
          : await generateInwardChallanNumber(tx);

      // Convert date strings into Date objects for Prisma
      const dateFieldsToConvert = [
        "inwardChallanDate",
        "challanDate",
        "lRDate",
        "billDate",
      ];
      const restWithDates: any = { ...rest };
      dateFieldsToConvert.forEach((f) => {
        const v = restWithDates[f];
        if (!v) return;
        if (v instanceof Date) return; // already a Date
        if (typeof v === "string") {
          const base = new Date(v);
          if (!isNaN(base.getTime())) {
            const now = new Date();
            base.setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
              now.getMilliseconds()
            );
            restWithDates[f] = base;
          }
        }
      });

      const userId = (auth as any).user?.id as number;

      // Prepare details computation (rate, amount) and billAmount
      let detailsCreateDataBase: Array<{
        poDetailsId: number;
        receivingQty: number;
        rate: number;
        amount: number;
      }> = [];
      let totalBillAmount = 0;
      let itemIdMap: Map<number, number> = new Map();

      if (
        inwardDeliveryChallanDetails &&
        Array.isArray(inwardDeliveryChallanDetails) &&
        inwardDeliveryChallanDetails.length > 0
      ) {
        const ids = inwardDeliveryChallanDetails.map((d: any) => d.poDetailsId);
        const poDetails = await tx.purchaseOrderDetail.findMany({
          where: { id: { in: ids } },
          select: { id: true, amount: true, qty: true, itemId: true },
        });
        const rateMap = new Map<number, number>(
          poDetails.map((d: any) => {
            const poQty = Number(d.qty ?? 0);
            const poAmt = Number(d.amount ?? 0);
            const computedRate = poQty > 0 ? poAmt / poQty : 0;
            return [d.id, Number(computedRate.toFixed(4))];
          })
        );
        itemIdMap = new Map<number, number>(
          poDetails.map((d: any) => [d.id, Number(d.itemId)])
        );

        detailsCreateDataBase = inwardDeliveryChallanDetails.map(
          (detail: any) => {
            const rate = rateMap.get(detail.poDetailsId) ?? 0;
            const receivingQty = Number(detail.receivingQty ?? 0);
            const amount = Number((rate * receivingQty).toFixed(2));
            return {
              poDetailsId: detail.poDetailsId,
              receivingQty,
              rate,
              amount,
            };
          }
        );

        totalBillAmount = detailsCreateDataBase.reduce(
          (acc, d) => acc + (Number.isFinite(d.amount) ? d.amount : 0),
          0
        );
      }

      const createData: Prisma.InwardDeliveryChallanCreateInput = {
        ...restWithDates,
        inwardChallanNo: finalInwardChallanNo,
        billAmount: totalBillAmount,
        purchaseOrder: { connect: { id: purchaseOrderId as number } },
        vendor: { connect: { id: vendorId as number } },
        site: { connect: { id: siteId as number } },
        createdBy: { connect: { id: userId } },
        updatedBy: { connect: { id: userId } },
      };

      const createdMain = await tx.inwardDeliveryChallan.create({
        data: createData,
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
          createdAt: true,
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

      if (detailsCreateDataBase.length > 0) {
        // Create details with computed rate/amount
        const detailsCreateData = detailsCreateDataBase.map((d) => ({
          inwardDeliveryChallanId: createdMain.id,
          poDetailsId: d.poDetailsId,
          receivingQty: d.receivingQty,
          rate: d.rate,
          amount: d.amount,
        }));
        await tx.inwardDeliveryChallanDetail.createMany({
          data: detailsCreateData,
        });

        // Increment PO Detail receivedQty by receivingQty
        for (const d of detailsCreateDataBase) {
          await tx.purchaseOrderDetail.update({
            where: { id: d.poDetailsId },
            data: { receivedQty: { increment: d.receivingQty } },
          });
        }

        // Create Stock Ledger entries per detail
        const txnDate: Date =
          (restWithDates as any)?.inwardChallanDate instanceof Date
            ? (restWithDates as any).inwardChallanDate
            : new Date();
        const stockRows = detailsCreateDataBase
          .map((d) => {
            const itemId = (itemIdMap as any)?.get?.(d.poDetailsId);
            if (!itemId) return null;
            return {
              siteId: Number(siteId),
              transactionDate: txnDate,
              itemId: Number(itemId),
              inwardDeliveryChallanId: createdMain.id,
              receivedQty: d.receivingQty,
              issuedQty: 0,
              unitRate: d.rate,
              documentType: "INWARD DLIVERY CHALLAN",
            };
          })
          .filter(Boolean) as Array<{
          siteId: number;
          transactionDate: Date;
          itemId: number;
          inwardDeliveryChallanId: number;
          receivedQty: number;
          issuedQty: number;
          unitRate: number;
          documentType: string;
        }>;
        if (stockRows.length > 0) {
          await tx.stockLedger.createMany({ data: stockRows });
        }

        // Update SiteItem (closing stock/value per siteId+itemId)
        // Build totals by itemId from details
        const totalsByItem = new Map<number, { qty: number; value: number }>();
        for (const d of detailsCreateDataBase) {
          const itemId = (itemIdMap as any)?.get?.(d.poDetailsId);
          if (!itemId) continue;
          const prev = totalsByItem.get(itemId) || { qty: 0, value: 0 };
          totalsByItem.set(itemId, {
            qty: Number((prev.qty + Number(d.receivingQty || 0)).toFixed(4)),
            value: Number((prev.value + Number(d.amount || 0)).toFixed(4)),
          });
        }

        // Apply per itemId totals to site_items
        for (const [itemId, totals] of totalsByItem.entries()) {
          const existing = await tx.siteItem.findFirst({
            where: { siteId: Number(siteId), itemId: Number(itemId) },
            select: {
              id: true,
              closingStock: true,
              closingValue: true,
            },
          });

          if (!existing) {
            const closingStock = Number(Number(totals.qty || 0).toFixed(4));
            const closingValue = Number(Number(totals.value || 0).toFixed(4));
            const unitRate =
              closingStock > 0
                ? Number((closingValue / closingStock).toFixed(4))
                : 0;
            await tx.siteItem.create({
              data: {
                siteId: Number(siteId),
                itemId: Number(itemId),
                closingStock,
                closingValue,
                unitRate,
                log: "IDC New",
              } as any,
            });
          } else {
            const prevStock = Number(existing.closingStock || 0);
            const prevValue = Number(existing.closingValue || 0);
            const nextStock = Number(
              (prevStock + (totals.qty || 0)).toFixed(4)
            );
            const nextValue = Number(
              (prevValue + (totals.value || 0)).toFixed(4)
            );
            const unitRate =
              nextStock > 0 ? Number((nextValue / nextStock).toFixed(4)) : 0;
            await tx.siteItem.update({
              where: { id: existing.id },
              data: {
                closingStock: nextStock,
                closingValue: nextValue,
                unitRate,
                log: "IDC Old",
              } as any,
            });
          }
        }
      }

      return createdMain;
    });

    // Persist inward delivery challan documents
    if (
      inwardDeliveryChallanDocumentMetadata.length > 0 ||
      inwardDeliveryChallanDocumentFiles.length > 0
    ) {
      const filesByIndex = new Map<number, File>();
      inwardDeliveryChallanDocumentFiles.forEach(({ index, file }) =>
        filesByIndex.set(index, file)
      );

      const createPayload: Array<{
        inwardDeliveryChallanId: number;
        documentName: string;
        documentUrl: string;
      }> = [];
      for (const docMeta of inwardDeliveryChallanDocumentMetadata) {
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
          inwardDeliveryChallanId: created.id,
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

    return Success(created, 201);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return ApiError("Inward delivery challan already exists", 409);
    }
    console.error("Create inward delivery challan error:", error);
    return ApiError("Failed to create inward delivery challan");
  }
}


