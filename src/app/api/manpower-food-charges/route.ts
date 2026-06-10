import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";
import { z } from "zod";

const createSchema = z.object({
  monthYear: z.string().min(1).max(50),
  details: z
    .array(
      z.object({
        manpowerId: z.coerce.number().int().positive(),
        foodCharges1: z.coerce.number().nonnegative().optional().nullable(),
        foodCharges2: z.coerce.number().nonnegative().optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

const updateSchema = createSchema
  .partial()
  .extend({
    id: z.coerce.number().int().positive(),
    details: z
      .array(
        z.object({
          manpowerId: z.coerce.number().int().positive(),
          foodCharges1: z.coerce.number().nonnegative().optional().nullable(),
          foodCharges2: z.coerce.number().nonnegative().optional().nullable(),
        })
      )
      .optional(),
  });

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const siteIdParam = (searchParams.get("siteId") || "").trim();
  const monthParam = (searchParams.get("monthYear") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type WhereType = {
    OR?: {
      monthYear?: { contains: string };
    }[];
    monthYear?: string;
  };
  const where: WhereType = {};
  if (search) {
    where.OR = [
      { monthYear: { contains: search } },
    ];
  }

  if (monthParam) where.monthYear = monthParam;

  const sortableFields = new Set(["monthYear", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { createdAt: "desc" };

  // Admin or normal users can see food charges now because there's no site filtering anymore.

  const result = await paginate({
    model: prisma.manpowerFoodCharges as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      monthYear: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const userDetails = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true } });
  const userName = userDetails?.name?.trim() || "";

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const monthVal = parsed.monthYear.trim();
    const existingCombo = await prisma.manpowerFoodCharges.findFirst({
      where: {
        monthYear: monthVal,
      },
      select: { id: true },
    });
    if (existingCombo) {
      return Error("Manpower Food Charges for selected month already exists", 400);
    }

    const detailsCreate = (parsed.details || []).map((d) => ({
      manpowerId: Number(d.manpowerId),
      foodCharges1: d.foodCharges1 === null || d.foodCharges1 === undefined ? null : Number(d.foodCharges1),
      foodCharges2: d.foodCharges2 === null || d.foodCharges2 === undefined ? null : Number(d.foodCharges2),
    })).filter(d => d.foodCharges1 !== null || d.foodCharges2 !== null);

    const created = await prisma.manpowerFoodCharges.create({
      data: {
        monthYear: monthVal,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        CreatedByName: userName,
        UpdatedByName: userName,
        ...(detailsCreate.length
          ? { manpowerFoodChargesDetails: { create: detailsCreate as any } }
          : {}),
      } as any,
      select: {
        id: true,
        monthYear: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    return Success(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return Error(err.errors as any, 400);
    console.error("Error creating Manpower Food Charges:", err);
    return Error("Failed to create Manpower Food Charges", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const userDetails = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true } });
  const userName = userDetails?.name?.trim() || "";

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const existing = await prisma.manpowerFoodCharges.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        monthYear: true,
      },
    });
    if (!existing) return Error("Manpower Food Charges not found", 404);

    const nextMonth = parsed.monthYear !== undefined ? parsed.monthYear.trim() : existing.monthYear;

    const existingCombo = await prisma.manpowerFoodCharges.findFirst({
      where: {
        monthYear: nextMonth,
        id: { not: parsed.id },
      },
      select: { id: true },
    });
    if (existingCombo) {
      return Error("Manpower Food Charges for selected month already exists", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (Array.isArray(parsed.details)) {
        for (const d of parsed.details) {
          const manpowerId = Number(d.manpowerId);
          const foodCharges1 = d.foodCharges1 === null || d.foodCharges1 === undefined ? null : Number(d.foodCharges1);
          const foodCharges2 = d.foodCharges2 === null || d.foodCharges2 === undefined ? null : Number(d.foodCharges2);
          const bothNull = foodCharges1 === null && foodCharges2 === null;

          const existingDetail = await tx.manpowerFoodChargesDetail.findFirst({
            where: { manpowerFoodChargesId: parsed.id, manpowerId },
            select: { id: true },
          });

          if (existingDetail) {
            if (bothNull) {
              await tx.manpowerFoodChargesDetail.delete({
                where: { id: existingDetail.id },
              });
            } else {
              await tx.manpowerFoodChargesDetail.update({
                where: { id: existingDetail.id },
                data: { foodCharges1, foodCharges2 } as any,
              });
            }
          } else if (!bothNull) {
            await tx.manpowerFoodChargesDetail.create({
              data: {
                manpowerFoodChargesId: parsed.id,
                manpowerId,
                foodCharges1,
                foodCharges2,
              } as any,
            });
          }
        }
      }

      return tx.manpowerFoodCharges.update({
        where: { id: parsed.id },
        data: {
          monthYear: nextMonth,
          updatedById: auth.user.id,
          UpdatedByName: userName,
        },
        select: { id: true },
      });
    });

    return Success(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return Error(err.errors as any, 400);
    console.error("Error updating Manpower Food Charges:", err);
    return Error("Failed to update Manpower Food Charges", 500);
  }
}
