import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
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
}).superRefine(async (data, ctx) => {
  const code = String(data.code || "").trim();
  if (code) {
    const existingCode = await prisma.subContractor.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existingCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["code"],
        message: "Code already exists",
      });
    }
  }

  const panNumber = String(data.panNumber || "").trim();
  if (panNumber) {
    const existingPan = await prisma.subContractor.findUnique({
      where: { panNumber },
      select: { id: true },
    });
    if (existingPan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["panNumber"],
        message: "PAN Number already exists",
      });
    }
  }

  const gstNumber = String(data.gstNumber || "").trim();
  if (gstNumber) {
    const existingGst = await prisma.subContractor.findUnique({
      where: { gstNumber },
      select: { id: true },
    });
    if (existingGst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstNumber"],
        message: "GST Number already exists",
      });
    }
  }
});

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "name") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { panNumber: { contains: search } },
        { gstNumber: { contains: search } },
        {
          subContractorContacts: {
            some: {
              OR: [
                { contactPersonName: { contains: search } },
                { mobile: { contains: search } },
              ],
            },
          },
        },
      ];
    }

    const sortableFields = new Set([
      "name",
      "code",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { name: "asc" };

    const result = await paginate({
      model: prisma.subContractor,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        code: true,
        name: true,
        contactPerson: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        stateId: true,
        cityId: true,
        panNumber: true,
        gstNumber: true,
        bankName: true,
        accountNumber: true,
        createdAt: true,
        updatedAt: true,
        state: {
          select: {
            id: true,
            state: true,
          },
        },
        city: {
          select: {
            id: true,
            city: true,
          },
        },
        subContractorContacts: true,
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get sub-contractors error:", error);
    return ApiError("Failed to fetch sub-contractors");
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const data = await req.json();
    const validatedData = await createSchema.parseAsync(data);

    const result = await prisma.$transaction(async (tx) => {
      let nextCode = validatedData.code;
      if (!nextCode) {
        const lastSub = await tx.subContractor.findFirst({
          orderBy: { id: "desc" },
          select: { code: true },
        });

        let nextNum = 1;
        if (lastSub?.code) {
          const match = lastSub.code.match(/\d+/);
          if (match) {
            nextNum = parseInt(match[0], 10) + 1;
          }
        }
        nextCode = String(nextNum).padStart(4, "0");
      }

      const subContractor = await tx.subContractor.create({
        data: {
          code: nextCode as string,
          name: validatedData.name,
          contactPerson: validatedData.contactPerson,
          addressLine1: validatedData.addressLine1,
          addressLine2: validatedData.addressLine2,
          pinCode: validatedData.pinCode,
          stateId: validatedData.stateId,
          cityId: validatedData.cityId,
          bankName: validatedData.bankName,
          branchName: validatedData.branchName,
          branchCode: validatedData.branchCode,
          accountNumber: validatedData.accountNumber,
          ifscCode: validatedData.ifscCode,
          panNumber: validatedData.panNumber,
          gstNumber: validatedData.gstNumber,
          cinNumber: validatedData.cinNumber,
          vatTinNumber: validatedData.vatTinNumber,
          cstTinNumber: validatedData.cstTinNumber,
          createdById: auth.user.id,
          updatedById: auth.user.id,
        },
      });

      if (validatedData.subContractorContacts?.length) {
        await tx.subContractorContact.createMany({
          data: validatedData.subContractorContacts.map((contact) => ({
            subContractorId: subContractor.id,
            contactPersonName: contact.contactPersonName,
            mobile: contact.mobile,
            email: contact.email,
          })),
        });
      }

      return await tx.subContractor.findUnique({
        where: { id: subContractor.id },
        include: {
          state: true,
          city: true,
          subContractorContacts: true,
        },
      });
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      const target = (error?.meta as any)?.target;
      if (Array.isArray(target)) {
        if (target.includes("code")) return BadRequest([{ code: "custom", path: ["code"], message: "Code already exists" }]);
        if (target.includes("panNumber")) return BadRequest([{ code: "custom", path: ["panNumber"], message: "PAN Number already exists" }]);
        if (target.includes("gstNumber")) return BadRequest([{ code: "custom", path: ["gstNumber"], message: "GST Number already exists" }]);
      }
      return ApiError("SubContractor already exists", 409);
    }
    console.error("Create sub-contractor error:", error);
    return ApiError("Failed to create sub-contractor");
  }
}
