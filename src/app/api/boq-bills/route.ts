import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

function toDbDate(input: string): Date {
  const s = String(input || "").trim();
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  const day = d.toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`);
}

const createSchema = z.object({
  boqId: z.coerce.number().int().min(1, "BOQ is required"),
  billNumber: z.string().min(1).max(100),
  billName: z.string().min(1).max(200),
  billDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid bill date" }),
  remarks: z.string().optional().nullable(),
  details: z
    .array(
      z.object({
        boqItemId: z.coerce.number().int().min(1),
        qty: z.coerce.number().min(0),
      })
    )
    .default([]),
});

// GET /api/boq-bills?search=&page=1&perPage=10&sort=billDate&order=desc&boqId=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = (searchParams.get("search") || "").trim();
    const sort = (searchParams.get("sort") || "billDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { billNumber: { contains: search } },
        { billName: { contains: search } },
        { boq: { boqNo: { contains: search } } },
      ];
    }

    const boqId = Number(searchParams.get("boqId"));
    if (!Number.isNaN(boqId) && boqId > 0) where.boqId = boqId;

    const sortableFields = new Set(["billDate", "createdAt", "billNumber"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { billDate: "desc" };

    const result = await paginate({
      model: prisma.bOQBill as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        boqId: true,
        billNumber: true,
        billName: true,
        billDate: true,
        remarks: true,
        totalBillAmount: true,
        createdAt: true,
        updatedAt: true,
        boq: {
          select: {
            id: true,
            boqNo: true,
            workName: true,
            site: { select: { id: true, site: true } },
          },
        },
      },
    });

    const data = (result.data as any[]).map((r) => {
      const totalAmount = Number(r.totalBillAmount || 0);
      return { ...r, totalAmount };
    });

    return Success({ ...result, data });
  } catch (error) {
    console.error("Get boq-bills error:", error);
    return ApiError("Failed to fetch boq-bills");
  }
}

// POST /api/boq-bills
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const boq = await prisma.boq.findUnique({
      where: { id: parsed.boqId },
      select: { id: true },
    });
    if (!boq) return BadRequest("BOQ not found");

    const itemIds = Array.from(
      new Set((parsed.details || []).map((d) => Number(d.boqItemId)))
    ).filter((v) => Number.isFinite(v) && v > 0);

    const boqItems = itemIds.length
      ? await prisma.boqItem.findMany({
          where: { id: { in: itemIds }, boqId: parsed.boqId },
          select: { id: true, rate: true },
        })
      : [];

    if (itemIds.length && boqItems.length !== itemIds.length) {
      return BadRequest("One or more BOQ items are invalid for selected BOQ");
    }

    const rateById = new Map<number, number>();
    boqItems.forEach((it) => rateById.set(it.id, Number(it.rate || 0)));

    const detailsCreate = (parsed.details || [])
      .filter((d) => Number(d.qty || 0) !== 0)
      .map((d) => {
        const boqItemId = Number(d.boqItemId);
        const qty = Number(d.qty || 0);
        const rate = Number(rateById.get(boqItemId) || 0);
        const amount = Number((qty * rate).toFixed(2));
        return {
          boqItemId,
          qty: qty as any,
          amount: amount as any,
        };
      });

    const totalBillAmount = Number(
      detailsCreate.reduce((sum, d) => sum + Number((d as any).amount || 0), 0).toFixed(2)
    );

    const created = await prisma.bOQBill.create({
      data: {
        boqId: parsed.boqId,
        billNumber: parsed.billNumber.trim(),
        billName: parsed.billName.trim(),
        billDate: toDbDate(parsed.billDate),
        remarks: parsed.remarks ?? null,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        totalBillAmount: totalBillAmount as any,
        ...(detailsCreate.length
          ? { boqBillDetails: { create: detailsCreate } }
          : {}),
      } as any,
      select: {
        id: true,
        boqId: true,
        billNumber: true,
        billName: true,
        billDate: true,
        remarks: true,
        totalBillAmount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (error?.code === "P2002") return ApiError("Bill number already exists", 409);
    console.error("Create boq-bill error:", error);
    return ApiError("Failed to create boq-bill");
  }
}
