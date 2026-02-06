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
import { PERMISSIONS, ROLES } from "@/config/roles";

async function generateOutwardChallanNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const candidates = await tx.outwardDeliveryChallan.findMany({
    where: {
      outwardChallanNo: {
        contains: "-",
      },
    },
    orderBy: { outwardChallanNo: "desc" },
    select: { outwardChallanNo: true },
    take: 50,
  });
  const latest = candidates.find((c) =>
    /^\d{4}-\d{4}$/.test(c.outwardChallanNo)
  );

  let left = 1;
  let right = 1;

  if (latest?.outwardChallanNo) {
    const parts = latest.outwardChallanNo.split("-");
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
  outwardChallanNo: z.string().max(50).optional(),
  outwardChallanDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid outward challan date",
  }),
  challanNo: z.string().min(1, "Challan No is required").max(100),
  challanDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid challan date",
  }),
  fromSiteId: z.number().int().positive("From Site is required"),
  toSiteId: z.number().int().positive("To Site is required"),
  outwardDeliveryChallanDetails: z
    .array(
      z.object({
        itemId: z.number().int().positive("Item ID is required"),
        challanQty: z.number().min(0).default(0),
      })
    )
    .min(1, "At least one item is required"),
});

// GET /api/outward-delivery-challans?search=&page=1&perPage=10&sort=outwardChallanNo&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const permSet = new Set((auth.user.permissions || []) as string[]);
    const canRead = permSet.has(PERMISSIONS.READ_OUTWARD_DELIVERY_CHALLAN);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "outwardChallanNo") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { outwardChallanNo: { contains: search } },
        { challanNo: { contains: search } },
        { fromSite: { site: { contains: search } } },
        { toSite: { site: { contains: search } } },
      ];
    }

    const fromSiteIdParam = searchParams.get("fromSiteId");
    if (fromSiteIdParam && !isNaN(Number(fromSiteIdParam))) {
      where.fromSiteId = Number(fromSiteIdParam);
    }
    const toSiteIdParam = searchParams.get("toSiteId");
    if (toSiteIdParam && !isNaN(Number(toSiteIdParam))) {
      where.toSiteId = Number(toSiteIdParam);
    }

    const sortableFields = new Set([
      "outwardChallanNo",
      "outwardChallanDate",
      "challanNo",
      "challanDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { outwardChallanNo: "asc" };

    // VIEW-only users are allowed to access the list page but must not see any records.
    if (!canRead) {
      return Success({ data: [], page, perPage, total: 0, totalPages: 1 });
    }

    // Site-based visibility: only ADMIN can see all; others restricted to assigned sites (either fromSite or toSite)
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      const ids = assignedSiteIds.length > 0 ? assignedSiteIds : [-1];
      where.AND = where.AND || [];
      where.AND.push({ OR: [{ fromSiteId: { in: ids } }, { toSiteId: { in: ids } }] });
    }

    const result = await paginate({
      model: prisma.outwardDeliveryChallan as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        outwardChallanNo: true,
        outwardChallanDate: true,
        challanNo: true,
        challanDate: true,
        fromSiteId: true,
        toSiteId: true,
        createdById: true,
        approved1ById: true,
        acceptedById: true,
        isApproved1: true,
        isAccepted: true,
        createdAt: true,
        updatedAt: true,
        fromSite: { select: { id: true, site: true } },
        toSite: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        approved1By: { select: { id: true, name: true } },
        acceptedBy: { select: { id: true, name: true } },
        outwardDeliveryChallanDetails: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            challanQty: true,
            approved1Qty: true,
            receivedQty: true,
            item: { select: { id: true, item: true, itemCode: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get outward delivery challans error:", error);
    return ApiError("Failed to fetch outward delivery challans");
  }
}

// POST /api/outward-delivery-challans - Create new outward delivery challan
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";

    let payloadData: Record<string, unknown> = {};
    let outwardDocumentsMeta: Array<{
      id?: number;
      documentName: string;
      documentUrl?: string;
      index: number;
    }> = [];
    const outwardDocumentFiles: Array<{ index: number; file: File }> = [];

    const saveOutwardDoc = async (file: File | null, subname: string) => {
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
      const filename = `${Date.now()}-outward-delivery-challan-doc-${crypto.randomUUID()}${ext}`;
      const dir = path.join(
        process.cwd(),
        "uploads",
        "outward-delivery-challans"
      );
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await file.arrayBuffer())
      );
      return `/uploads/outward-delivery-challans/${filename}`;
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      payloadData = {
        outwardChallanNo: (() => {
          const v = form.get("outwardChallanNo");
          return typeof v === "string" && v.trim().length > 0 ? v : undefined;
        })(),
        outwardChallanDate: form.get("outwardChallanDate"),
        challanNo: form.get("challanNo"),
        challanDate: form.get("challanDate"),
        fromSiteId: form.get("fromSiteId")
          ? Number(form.get("fromSiteId"))
          : undefined,
        toSiteId: form.get("toSiteId")
          ? Number(form.get("toSiteId"))
          : undefined,
        createdById: form.get("createdById")
          ? Number(form.get("createdById"))
          : undefined,
        updatedById: form.get("updatedById")
          ? Number(form.get("updatedById"))
          : undefined,
      };

      const detailsJson = form.get("outwardDeliveryChallanDetails");
      if (typeof detailsJson === "string" && detailsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(detailsJson);
          if (Array.isArray(parsed)) {
            payloadData.outwardDeliveryChallanDetails = parsed;
          }
        } catch (e) {
          console.warn(
            "Failed to parse outwardDeliveryChallanDetails (POST)",
            e
          );
        }
      }

      const documentsJson = form.get("outwardDeliveryChallanDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            outwardDocumentsMeta = parsed
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
            "Failed to parse outwardDeliveryChallanDocuments metadata (POST)",
            e
          );
        }
      }

      form.forEach((value, key) => {
        const match = key.match(
          /^outwardDeliveryChallanDocuments\[(\d+)\]\[documentFile\]$/
        );
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File)
          outwardDocumentFiles.push({ index: idx, file: fileVal });
      });
    } else {
      payloadData = await req.json();
      outwardDocumentsMeta = Array.isArray(
        (payloadData as any)?.outwardDeliveryChallanDocuments
      )
        ? (payloadData as any).outwardDeliveryChallanDocuments.map(
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

    const validated = createSchema.parse(payloadData);

    const created = await prisma.$transaction(async (tx) => {
      const { outwardDeliveryChallanDetails, ...rest } = validated as any;

      const {
        outwardChallanNo: rawNo,
        outwardChallanDate,
        challanNo,
        challanDate,
        fromSiteId,
        toSiteId,
      } = rest as any;

      const finalOutwardNo =
        typeof rawNo === "string" && rawNo.trim().length > 0
          ? rawNo.trim()
          : await generateOutwardChallanNumber(tx);

      // Normalize dates to Date objects
      const restWithDates: any = {
        outwardChallanDate,
        challanNo,
        challanDate,
      };
      const dateFieldsToConvert = ["outwardChallanDate", "challanDate"];
      dateFieldsToConvert.forEach((f) => {
        const v = restWithDates[f];
        if (!v) return;
        if (v instanceof Date) return;
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

      const createData: Prisma.OutwardDeliveryChallanCreateInput = {
        outwardChallanNo: finalOutwardNo,
        outwardChallanDate: restWithDates.outwardChallanDate,
        challanNo: restWithDates.challanNo,
        challanDate: restWithDates.challanDate,
        fromSite: { connect: { id: Number(fromSiteId) } },
        toSite: { connect: { id: Number(toSiteId) } },
        createdBy: { connect: { id: userId } },
        updatedBy: { connect: { id: userId } },
      } as any;

      const createdMain = await tx.outwardDeliveryChallan.create({
        data: createData,
        select: {
          id: true,
          outwardChallanNo: true,
          outwardChallanDate: true,
          challanNo: true,
          challanDate: true,
          fromSiteId: true,
          toSiteId: true,
          createdAt: true,
          fromSite: { select: { id: true, site: true } },
          toSite: { select: { id: true, site: true } },
        },
      });

      // Create Details
      if (
        outwardDeliveryChallanDetails &&
        Array.isArray(outwardDeliveryChallanDetails) &&
        outwardDeliveryChallanDetails.length > 0
      ) {
        const detailsData = outwardDeliveryChallanDetails.map((d: any) => ({
          outwardDeliveryChallanId: createdMain.id,
          itemId: Number(d.itemId),
          qty: Number(d.challanQty ?? 0),
          challanQty: Number(d.challanQty ?? 0),
          approved1Qty: 0,
          receivedQty: 0,
        }));
        await tx.outwardDeliveryChallanDetail.createMany({ data: detailsData });
      }

      return createdMain;
    });

    // Save documents (after main create)
    if (outwardDocumentsMeta.length > 0 || outwardDocumentFiles.length > 0) {
      const filesByIndex = new Map<number, File>();
      outwardDocumentFiles.forEach(({ index, file }) =>
        filesByIndex.set(index, file)
      );

      const createPayload: Array<{
        outwardDeliveryChallanId: number;
        documentName: string;
        documentUrl: string;
      }> = [];
      for (const docMeta of outwardDocumentsMeta) {
        const name = (docMeta.documentName || "").trim();
        const file = filesByIndex.get(docMeta.index ?? -1);
        const trimmedUrl = docMeta.documentUrl?.trim();
        let finalUrl =
          trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
        if (file) {
          const saved = await saveOutwardDoc(file, "doc");
          finalUrl = saved ?? undefined;
        }
        if (!name || !finalUrl) continue;
        createPayload.push({
          outwardDeliveryChallanId: (created as any).id,
          documentName: name,
          documentUrl: finalUrl,
        });
      }
      if (createPayload.length > 0) {
        await prisma.outwardDeliveryChallanDocuments.createMany({
          data: createPayload,
        });
      }
    }

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as any).code === "P2002"
    ) {
      return ApiError("Outward delivery challan already exists", 409);
    }
    console.error("Create outward delivery challan error:", error);
    return ApiError("Failed to create outward delivery challan");
  }
}
