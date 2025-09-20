import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/billing-addresses/[id] - Get single Billing Address
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const billingAddress = await prisma.billingAddress.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        landline1: true,
        landline2: true,
        fax: true,
        email: true,
        panNumber: true,
        vatTinNumber: true,
        gstNumber: true,
        cstTinNumber: true,
        cinNumber: true,
        stateCode: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!billingAddress) return Error('Billing Address not found', 404);
    return Success(billingAddress);
  } catch (err) {
    console.error('Error fetching Billing Address:', err);
    return Error('Failed to fetch Billing Address', 500);
  }
}

// DELETE /api/billing-addresses/[id] - Delete Billing Address
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    // Check if Billing Address exists
    const existing = await prisma.billingAddress.findUnique({ where: { id } });
    if (!existing) return Error('Billing Address not found', 404);

    await prisma.billingAddress.delete({ where: { id } });
    return Success({ message: 'Billing Address deleted successfully' });
  } catch (err) {
    console.error('Error deleting Billing Address:', err);
    return Error('Failed to delete Billing Address', 500);
  }
}
