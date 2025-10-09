// /app/api/daily-progresses/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/daily-progresses?search=&page=1&perPage=10&sort=progressDate&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "progressDate") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  type DPWhere = {
    OR?: (
      | { site: { site: { contains: string } } }
      | { boq: { boqNo: { contains: string } } }
    )[];
  };
  const where: DPWhere = {};

  // 🔍 Search by Site name OR BOQ number (case-insensitive)
  if (search) {
    where.OR = [
      { site: { site: { contains: search } } },
      { boq: { boqNo: { contains: search } } },
    ];
  }

  const sortableFields = new Set(["progressDate", "createdAt", "amount"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { progressDate: "desc" };

  const result = await paginate({
    model: prisma.dailyProgress as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      progressDate: true,
      amount: true,
      site: { select: { id: true, site: true } },
      boq: { select: { id: true, boqNo: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return Success(result);
}

// POST /api/daily-progresses
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const userId = auth.user?.id; // ✅ automatically from logged-in user

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, any>) || {};

  const siteId = Number(b.siteId);
  const boqId = Number(b.boqId);
  const progressDate = b.progressDate ? new Date(String(b.progressDate)) : null;
  if (!siteId || !boqId || !progressDate)
    return Error("Missing required fields", 400);

  try {
    const details = Array.isArray(b.details)
      ? b.details.map((it: any) => ({
          boqItemId: it.boqItemId ?? null,
          clientSerialNo: it.clientSerialNo ?? null,
          activityId: it.activityId ?? null,
          particulars: it.particulars ?? null,
          doneQty: it.doneQty ?? 0,
          amount: it.amount ?? 0,
        }))
      : [];

    // 🔹 Calculate total doneQty
    const totalDoneQty = details.reduce(
      (sum, d) => sum + Number(d.doneQty || 0),
      0
    );

    const hindrances = Array.isArray(b.hindrances)
      ? b.hindrances.map((it: any) => ({
          from: it.from ? new Date(String(it.from)) : null,
          to: it.to ? new Date(String(it.to)) : null,
          hrs: it.hrs ?? null,
          location: it.location ?? null,
          reason: it.reason ?? null,
        }))
      : [];

    const created = await prisma.dailyProgress.create({
      data: {
        siteId,
        boqId,
        progressDate,
        amount: totalDoneQty, // 🔹 use total doneQty as dailyProgress.amount
        createdById: userId, // ✅ automatic
        updatedById: userId, // ✅ automatic
        ...(details.length
          ? { dailyProgressDetails: { create: details } }
          : {}),
        ...(hindrances.length
          ? { dailyProgressHindrances: { create: hindrances } }
          : {}),
      },
      select: { id: true, progressDate: true },
    });

    return Success(created, 201);
  } catch (e) {
    console.log(e);
    return Error("Failed to create Daily Progress");
  }
}

// PATCH /api/daily-progresses
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const userId = auth.user?.id; // ✅ current logged-in user

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, any>) || {};
  const id = Number(b.id);
  if (!id) return Error("Daily Progress id required", 400);

  const data: Record<string, any> = {};
  if (b.siteId !== undefined)
    data.siteId = b.siteId == null ? null : Number(b.siteId);
  if (b.boqId !== undefined)
    data.boqId = b.boqId == null ? null : Number(b.boqId);
  if (b.progressDate !== undefined)
    data.progressDate = b.progressDate
      ? new Date(String(b.progressDate))
      : null;
  if (b.amount !== undefined) data.amount = b.amount ?? 0;
  data.updatedById = userId; // ✅ automatic on update
  data.amount = b.details.reduce((sum, d) => sum + Number(d.doneQty || 0), 0);
  if (Object.keys(data).length === 0 && !b.details && !b.hindrances)
    return Error("Nothing to update", 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 🔹 Calculate total doneQty

      const updated = await tx.dailyProgress.update({
        where: { id },
        data,
        select: { id: true, progressDate: true },
      });

      if (Array.isArray(b.details)) {
        await tx.dailyProgressDetail.deleteMany({
          where: { dailyProgressId: id },
        });
        for (const it of b.details) {
          await tx.dailyProgressDetail.create({
            data: {
              dailyProgressId: id,
              boqItemId: it.boqItemId ?? null,
              clientSerialNo: it.clientSerialNo ?? null,
              activityId: it.activityId ?? null,
              particulars: it.particulars ?? null,
              doneQty: it.doneQty ?? 0,
              amount: it.amount ?? 0,
            },
          });
        }
      }

      if (Array.isArray(b.hindrances)) {
        await tx.dailyProgressHindrance.deleteMany({
          where: { dailyProgressId: id },
        });
        for (const it of b.hindrances) {
          await tx.dailyProgressHindrance.create({
            data: {
              dailyProgressId: id,
              from: it.from ? new Date(String(it.from)) : null,
              to: it.to ? new Date(String(it.to)) : null,
              hrs: it.hrs ?? null,
              location: it.location ?? null,
              reason: it.reason ?? null,
            },
          });
        }
      }

      return updated;
    });
    return Success(result);
  } catch (e: any) {
    if (e?.code === "P2025") return Error("Daily Progress not found", 404);
    return Error("Failed to update Daily Progress");
  }
}
