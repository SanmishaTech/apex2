import { NextRequest, NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/config/roles";

export async function GET(request: NextRequest) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "10", 10);
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const skip = (page - 1) * perPage;

    // Build where clause for search
    const where: any = search
      ? {
          OR: [
            { challanNo: { contains: search, mode: "insensitive" as const } },
            { status: { contains: search, mode: "insensitive" as const } },
            {
              fromSite: {
                site: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              toSite: {
                site: { contains: search, mode: "insensitive" as const },
              },
            },
            { remarks: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
    const role = guardResult.user.role;
    const isPrivileged = role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: guardResult.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      // If no assigned sites, return empty set early
      if (!assignedSiteIds || assignedSiteIds.length === 0) {
        return NextResponse.json({
          data: [],
          meta: { page, perPage, total: 0, totalPages: 1 },
        });
      }

      // Restrict visibility to transfers involving assigned sites (either from or to)
      const siteVisibility = {
        OR: [
          { fromSiteId: { in: assignedSiteIds } },
          { toSiteId: { in: assignedSiteIds } },
        ],
      } as const;

      if (Object.keys(where).length > 0) {
        where.AND = where.AND ? [...where.AND, siteVisibility] : [siteVisibility];
      } else {
        Object.assign(where, siteVisibility);
      }
    }

    // Get total count for pagination
    const total = await prisma.manpowerTransfer.count({ where });

    // Get paginated results with relations
    const manpowerTransfers = await prisma.manpowerTransfer.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { [sort]: order },
      include: {
        fromSite: {
          select: { id: true, site: true, shortName: true },
        },
        toSite: {
          select: { id: true, site: true, shortName: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        transferItems: {
          include: {
            manpower: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                mobileNumber: true,
                manpowerSupplier: {
                  select: { id: true, supplierName: true },
                },
              },
            },
          },
        },
      },
    });

    const totalPages = Math.ceil(total / perPage);

    // Transform the response to flatten manpower data into transfer items
    const transformedTransfers = manpowerTransfers.map((transfer) => ({
      ...transfer,
      transferItems: transfer.transferItems.map((item) => ({
        id: item.id,
        manpowerId: item.manpowerId,
        // Flatten manpower personal details
        firstName: item.manpower.firstName,
        middleName: item.manpower.middleName,
        lastName: item.manpower.lastName,
        mobileNumber: item.manpower.mobileNumber,
        manpowerSupplier: item.manpower.manpowerSupplier,
        // Include assignment details from transfer item
        category: item.category,
        skillSet: item.skillSet,
        wage: item.wage,
        minWage: item.minWage,
        hours: item.hours,
        esic: item.esic,
        pf: item.pf,
        pt: item.pt,
        hra: item.hra,
        mlwf: item.mlwf,
      })),
    }));

    return NextResponse.json({
      data: transformedTransfers,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Manpower transfers GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch manpower transfers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const body = await request.json();
    const {
      challanDate,
      fromSiteId,
      toSiteId,
      manpowerIds,
      remarks,
    } = body;

    // Validate required fields
    if (
      !challanDate ||
      !fromSiteId ||
      !toSiteId ||
      !manpowerIds ||
      manpowerIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: challanDate, fromSiteId, toSiteId, manpowerIds",
        },
        { status: 400 }
      );
    }

    if (fromSiteId === toSiteId) {
      return NextResponse.json(
        { error: "Cannot transfer manpower to the same site" },
        { status: 400 }
      );
    }

    // Generate challan number
    const lastTransfer = await prisma.manpowerTransfer.findFirst({
      orderBy: { id: "desc" },
      select: { challanNo: true },
    });

    let nextNumber = 1;
    if (lastTransfer?.challanNo) {
      const match = lastTransfer.challanNo.match(/MPT-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const challanNo = `MPT-${nextNumber.toString().padStart(5, "0")}`;

    // Check if manpower is currently assigned to the from site
    const manpowerToTransfer = await prisma.manpower.findMany({
      where: {
        id: { in: manpowerIds },
        isAssigned: true,
        currentSiteId: fromSiteId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        category: true,
        skillSet: true,
        wage: true,
        minWage: true,
        hours: true,
        esic: true,
        pf: true,
        pt: true,
        hra: true,
        mlwf: true,
      },
    });

    if (manpowerToTransfer.length !== manpowerIds.length) {
      return NextResponse.json(
        {
          error:
            "Some manpower are not available for transfer. Only manpower currently assigned to the from site can be transferred.",
          available: manpowerToTransfer.map((m) => ({
            id: m.id,
            name: `${m.firstName} ${m.lastName}`,
          })),
          requested: manpowerIds,
        },
        { status: 400 }
      );
    }

    // Create the transfer in a transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Create the transfer record
      const newTransfer = await tx.manpowerTransfer.create({
        data: {
          challanNo,
          challanDate: new Date(challanDate),
          fromSiteId,
          toSiteId,
          remarks,
        },
        include: {
          fromSite: { select: { id: true, site: true } },
          toSite: { select: { id: true, site: true } },
        },
      });

      // Create transfer items with preserved assignment details
      const transferItems = await Promise.all(
        manpowerToTransfer.map(async (manpower) => {
          return tx.manpowerTransferItem.create({
            data: {
              manpowerTransferId: newTransfer.id,
              manpowerId: manpower.id,
              category: manpower.category,
              skillSet: manpower.skillSet,
              wage: manpower.wage,
              minWage: manpower.minWage,
              hours: manpower.hours,
              esic: manpower.esic,
              pf: manpower.pf,
              pt: manpower.pt,
              hra: manpower.hra,
              mlwf: manpower.mlwf,
            },
            include: {
              manpower: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  mobileNumber: true,
                  manpowerSupplier: {
                    select: { id: true, supplierName: true },
                  },
                },
              },
            },
          });
        })
      );

      return {
        ...newTransfer,
        transferItems,
      };
    });

    return NextResponse.json(
      {
        message: "Manpower transfer created successfully",
        data: transfer,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Manpower transfer POST error:", error);
    return NextResponse.json(
      { error: "Failed to create manpower transfer" },
      { status: 500 }
    );
  }
}
