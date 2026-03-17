import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { handleFileUpload } from "@/lib/upload";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const createSchema = z.object({
  siteId: z.coerce.number().int().positive(),
  type: z.enum(["IN", "OUT"]),
  latitude: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
  longitude: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
});

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return BadRequest("Content-Type must be multipart/form-data");
    }

    const form = await req.formData();

    const parsed = createSchema.parse({
      siteId: form.get("siteId"),
      type: form.get("type"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
    });

    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
      return BadRequest("Latitude and longitude are required");
    }

    const file = form.get("image") as File | null;
    if (!file || file.size === 0) {
      return BadRequest("Image is required");
    }

    const uploadResult = await handleFileUpload(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSize: 10 * 1024 * 1024,
      uploadDir: "uploads/employee-attendance",
    });

    if (!uploadResult.success || !uploadResult.filename) {
      return BadRequest(uploadResult.error || "Failed to upload image");
    }

    const imageUrl = `/api/uploads/employee-attendance/${uploadResult.filename}`;

    const employee = await prisma.employee.findFirst({
      where: { userId: auth.user.id },
      select: { id: true },
    });

    if (!employee) {
      return BadRequest("No employee record linked to current user");
    }

    const now = new Date();
    const dateObj = toDateOnly(now);

    const attendance = await prisma.employeeAttendance.upsert({
      where: {
        date_employeeId_type: {
          date: dateObj,
          employeeId: employee.id,
          type: parsed.type,
        },
      },
      update: {
        siteId: parsed.siteId,
        time: now,
        imageUrl,
        latitude: new Prisma.Decimal(parsed.latitude),
        longitude: new Prisma.Decimal(parsed.longitude),
        createdById: auth.user.id,
      },
      create: {
        date: dateObj,
        employeeId: employee.id,
        siteId: parsed.siteId,
        type: parsed.type,
        time: now,
        imageUrl,
        latitude: new Prisma.Decimal(parsed.latitude),
        longitude: new Prisma.Decimal(parsed.longitude),
        createdById: auth.user.id,
      },
      select: {
        id: true,
        date: true,
        employeeId: true,
        siteId: true,
        type: true,
        time: true,
        imageUrl: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });

    return Success({ data: attendance }, 201);
  } catch (error: any) {
    console.error("Create employee attendance error:", error);
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    return ApiError("Failed to create employee attendance");
  }
}
