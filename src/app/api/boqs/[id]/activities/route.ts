import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/boqs/[id]/activities - Get activities for a specific BOQ
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid BOQ ID', 400);

  try {
    // Check if BOQ exists
    const boq = await prisma.boq.findUnique({ where: { id } });
    if (!boq) return Error('BOQ not found', 404);

    // Get all activities (BOQ items) for this BOQ
    const activities = await prisma.boqItem.findMany({
      where: { 
        boqId: id,
        activityId: { not: '' } // Only get items that have an activity ID
      },
      select: {
        activityId: true,
        item: true,
        qty: true,
        rate: true,
        amount: true
      },
      orderBy: {
        activityId: 'asc'
      }
    });

    return Success(activities);
  } catch (err) {
    console.error('Error fetching BOQ activities:', err);
    return Error('Failed to fetch BOQ activities', 500);
  }
}
