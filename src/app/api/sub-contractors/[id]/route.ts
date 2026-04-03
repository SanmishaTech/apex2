import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { z } from "zod";

const updateSchema = z.object({
  code: z.string().min(1, "Code is required").optional(),
  name: z.string().min(1, "Name is required").optional(),
  contactPerson: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  bankName: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  cinNumber: z.string().optional().nullable(),
  vatTinNumber: z.string().optional().nullable(),
  cstTinNumber: z.string().optional().nullable(),
  subContractorContacts: z
    .array(
      z.object({
        id: z.number().optional(),
        contactPersonName: z.string().min(1, "Name is required"),
        mobile: z.string().optional().nullable(),
        email: z
          .string()
          .email("Invalid email address")
          .optional()
          .or(z.literal(""))
          .nullable(),
      })
    )
    .optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const permSet = new Set((auth.user.permissions || []) as string[]);
  if (!permSet.has(PERMISSIONS.READ_SUB_CONTRACTORS)) {
    return BadRequest("Missing permission to read sub contractors");
  }

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sub-contractor ID");

    const subContractor = await prisma.subContractor.findUnique({
      where: { id },
      include: {
        state: true,
        city: true,
        subContractorContacts: true,
      },
    });

    if (!subContractor) return NotFound("SubContractor not found");
    return Success(subContractor);
  } catch (error) {
    console.error("Get sub-contractor error:", error);
    return ApiError("Failed to fetch sub-contractor");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const permSet = new Set((auth.user.permissions || []) as string[]);
  if (!permSet.has(PERMISSIONS.EDIT_SUB_CONTRACTORS)) {
    return BadRequest("Missing permission to edit sub contractors");
  }

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sub-contractor ID");

    const data = await req.json();
    const validatedData = await updateSchema.parseAsync(data);

    // Uniqueness checks if updating relevant fields
    if (validatedData.code) {
      const existing = await prisma.subContractor.findFirst({
        where: { code: validatedData.code, id: { not: id } },
      });
      if (existing) return BadRequest([{ code: "custom", path: ["code"], message: "Code already exists" }]);
    }
    if (validatedData.panNumber) {
      const existing = await prisma.subContractor.findFirst({
        where: { panNumber: validatedData.panNumber, id: { not: id } },
      });
      if (existing) return BadRequest([{ code: "custom", path: ["panNumber"], message: "PAN Number already exists" }]);
    }
    if (validatedData.gstNumber) {
      const existing = await prisma.subContractor.findFirst({
        where: { gstNumber: validatedData.gstNumber, id: { not: id } },
      });
      if (existing) return BadRequest([{ code: "custom", path: ["gstNumber"], message: "GST Number already exists" }]);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const { subContractorContacts, ...subContractorData } = validatedData;

      await tx.subContractor.update({
        where: { id },
        data: {
          ...subContractorData,
          updatedById: auth.user.id,
        },
      });

      if (subContractorContacts) {
        const incomingIds = subContractorContacts
          .map((c) => c.id)
          .filter((v): v is number => typeof v === "number");

        // Delete removed
        await tx.subContractorContact.deleteMany({
          where: {
            subContractorId: id,
            id: { notIn: incomingIds },
          },
        });

        // Upsert incoming
        for (const contact of subContractorContacts) {
          if (contact.id) {
            await tx.subContractorContact.update({
              where: { id: contact.id },
              data: {
                contactPersonName: contact.contactPersonName,
                mobile: contact.mobile,
                email: contact.email,
              },
            });
          } else {
            await tx.subContractorContact.create({
              data: {
                subContractorId: id,
                contactPersonName: contact.contactPersonName,
                mobile: contact.mobile,
                email: contact.email,
              },
            });
          }
        }
      }

      return tx.subContractor.findUniqueOrThrow({
        where: { id },
        include: {
          state: true,
          city: true,
          subContractorContacts: true,
        },
      });
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("SubContractor not found");
    console.error("Update sub-contractor error:", error);
    return ApiError("Failed to update sub-contractor");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const permSet = new Set((auth.user.permissions || []) as string[]);
  if (!permSet.has(PERMISSIONS.DELETE_SUB_CONTRACTORS)) {
    return BadRequest("Missing permission to delete sub contractors");
  }

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid sub-contractor ID");

    await prisma.subContractor.delete({
      where: { id },
    });

    return Success({ message: "SubContractor deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("SubContractor not found");
    console.error("Delete sub-contractor error:", error);
    return ApiError("Failed to delete sub-contractor");
  }
}
