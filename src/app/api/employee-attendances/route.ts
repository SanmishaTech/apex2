import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { handleFileUpload } from "@/lib/upload";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const GEOAPIFY_API_KEY = (process.env.GEOAPIFY_API_KEY || "").trim().replace(/^["']|["]$/g, "");

async function getAddressFromLatLong(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Geoapify API error:", response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const properties = feature.properties;
      
      // Build address from available components
      const addressParts = [
        properties.name,
        properties.housenumber,
        properties.street,
        properties.suburb,
        properties.district,
        properties.city,
        properties.state,
        properties.postcode,
        properties.country
      ].filter(Boolean);
      
      return addressParts.join(", ") || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching address from Geoapify:", error);
    return null;
  }
}

const createSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  latitude: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
  longitude: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
  accuracy: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
  capturedAt: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v)),
});

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateOnlyIST(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const y = Number(parts.year);
  const m = Number(parts.month);
  const day = Number(parts.day);
  return new Date(Date.UTC(y, m - 1, day));
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
      type: form.get("type"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
      accuracy: form.get("accuracy"),
      capturedAt: form.get("capturedAt"),
    });

    if (
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude) ||
      !Number.isFinite(parsed.accuracy)
    ) {
      return BadRequest("Latitude, longitude and accuracy are required");
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

    const imageUrl = `/uploads/employee-attendance/${uploadResult.filename}`;

    const employee = await prisma.employee.findFirst({
      where: { userId: auth.user.id },
      select: { id: true },
    });

    if (!employee) {
      return BadRequest("No employee record linked to current user");
    }

    // Fetch address from Geoapify API
    const address = await getAddressFromLatLong(parsed.latitude, parsed.longitude);

    // Use capturedAt timestamp from client when image was captured
    const attendanceTime = new Date(parsed.capturedAt);
    const dateObj = toDateOnlyIST(attendanceTime);

    const existing = await prisma.employeeAttendance.findUnique({
      where: {
        date_employeeId_type: {
          date: dateObj,
          employeeId: employee.id,
          type: parsed.type,
        },
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.employeeAttendance.update({
        where: { id: existing.id },
        data: {
          time: attendanceTime,
          imageUrl,
          latitude: new Prisma.Decimal(parsed.latitude),
          longitude: new Prisma.Decimal(parsed.longitude),
          accuracy: new Prisma.Decimal(parsed.accuracy),
          address,
          createdById: auth.user.id,
        },
      });
      return Success({ data: updated }, 200);
    }

    const attendance = await prisma.employeeAttendance.create({
      data: {
        date: dateObj,
        employeeId: employee.id,
        type: parsed.type,
        time: attendanceTime,
        imageUrl,
        latitude: new Prisma.Decimal(parsed.latitude),
        longitude: new Prisma.Decimal(parsed.longitude),
        accuracy: new Prisma.Decimal(parsed.accuracy),
        address,
        createdById: auth.user.id,
      },
      select: {
        id: true,
        date: true,
        employeeId: true,
        type: true,
        time: true,
        imageUrl: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        address: true,
        createdAt: true,
      },
    });

    return Success({ data: attendance }, 201);
  } catch (error: any) {
    console.error("Create employee attendance error:", error);
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error?.code === "P2002") {
      return BadRequest("Attendance is already marked");
    }
    return ApiError("Failed to create employee attendance");
  }
}
