import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const status = searchParams.get("status");

    // Build where conditions
    const where: any = {};

    if (fromDate) {
      where.dueDate = {
        ...where.dueDate,
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.dueDate = {
        ...where.dueDate,
        lte: new Date(toDate),
      };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch rents with related data
    const rents = await prisma.rent.findMany({
      where,
      include: {
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        boq: {
          select: {
            id: true,
            boqNo: true,
          },
        },
        rentalCategory: {
          select: {
            id: true,
            rentalCategory: true,
          },
        },
        rentType: {
          select: {
            id: true,
            rentType: true,
          },
        },
      },
      orderBy: [
        { siteId: "asc" },
        { boqId: "asc" },
      ],
    });

    return Response.json({ data: rents });
  } catch (error: any) {
    console.error("Error fetching rent registration report:", error);
    return Response.json(
      { error: error.message || "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
