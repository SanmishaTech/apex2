import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import bcrypt from 'bcryptjs';
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ROLES } from "@/config/roles";

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

const createSchema = z.object({
  name: z.string().min(1, "Employee name is required"),
  departmentId: z.number().optional(),
  siteId: z.union([z.number(), z.array(z.number())]).optional(),
  resignDate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  role: z.enum(ROLE_VALUES).default(ROLES.USER),
  // Personal Details
  dateOfBirth: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  anniversaryDate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  spouseName: z.string().optional(),
  bloodGroup: z.string().optional(),
  // Address Details
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  stateId: z.number().optional(),
  cityId: z.number().optional(),
  pincode: z.string().optional(),
  // Contact Details
  mobile1: z.string().optional(),
  mobile2: z.string().optional(),
  // Other Details
  esic: z.string().optional(),
  pf: z.string().optional(),
  panNo: z.string().optional(),
  adharNo: z.string().optional(),
  cinNo: z.string().optional(),
  // Travel/Reporting Details
  airTravelClass: z.string().optional(),
  railwayTravelClass: z.string().optional(),
  busTravelClass: z.string().optional(),
  reporting1Id: z.number().optional(),
  reporting2Id: z.number().optional(),
  reportingSiteId: z.number().optional(),
  reportingSiteAssignedDate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  // Leave Details
  sickLeavesPerYear: z.number().optional(),
  paidLeavesPerYear: z.number().optional(),
  casualLeavesPerYear: z.number().optional(),
  balanceSickLeaves: z.number().optional(),
  balancePaidLeaves: z.number().optional(),
  balanceCasualLeaves: z.number().optional(),
  // User creation fields
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// GET /api/employees?search=&page=1&perPage=10&sort=name&order=asc&department=&site=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const departmentFilter = searchParams.get("department") || "";
    const siteFilter = searchParams.get("site") || "";
    const sort = (searchParams.get("sort") || "name") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    type EmployeeWhere = {
      OR?: Array<{ name?: { contains: string } }>;
      departmentId?: number;
      siteEmployees?: {
        some: {
          siteId: number;
        };
      };
    };

    const where: EmployeeWhere = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
      ];
    }

    if (departmentFilter) {
      const deptId = parseInt(departmentFilter);
      if (!isNaN(deptId)) {
        where.departmentId = deptId;
      }
    }

    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        where.siteEmployees = {
          some: {
            siteId: siteId,
          },
        };
      }
    }

    const sortableFields = new Set(["name", "createdAt", "resignDate"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { name: "asc" };

    const result = await paginate({
      model: prisma.employee as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        name: true,
        departmentId: true,
        resignDate: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            department: true,
          },
        },
        // Include site assignments data
        siteEmployees: {
          select: {
            id: true,
            siteId: true,
            assignedDate: true,
            site: {
              select: {
                id: true,
                site: true,
              },
            },
          },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get employees error:", error);
    return ApiError("Failed to fetch employees");
  }
}

// POST /api/employees - Create new employee
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let parsedData: z.infer<typeof createSchema>;
    let profilePic: File | null = null;
    let signature: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      // Collect file inputs
      profilePic = (form.get('profilePic') as File) || null;
      signature = (form.get('signature') as File) || null;

      // Map other fields
      const mapped = {
        name: String(form.get('name') || ''),
        departmentId: form.get('departmentId') ? Number(form.get('departmentId')) : undefined,
        siteId: form.get('siteId') ? (() => {
          const siteIdValue = form.get('siteId');
          if (typeof siteIdValue === 'string') {
            try {
              const parsed = JSON.parse(siteIdValue);
              return Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)];
            } catch {
              return [Number(siteIdValue)];
            }
          }
          return [Number(siteIdValue)];
        })() : undefined,
        resignDate: form.get('resignDate') ? String(form.get('resignDate')) : undefined,
        role: String(form.get('role') || 'user'),
        dateOfBirth: form.get('dateOfBirth') ? String(form.get('dateOfBirth')) : undefined,
        anniversaryDate: form.get('anniversaryDate') ? String(form.get('anniversaryDate')) : undefined,
        spouseName: (form.get('spouseName') as string) || undefined,
        bloodGroup: (form.get('bloodGroup') as string) || undefined,
        addressLine1: (form.get('addressLine1') as string) || undefined,
        addressLine2: (form.get('addressLine2') as string) || undefined,
        stateId: form.get('stateId') ? Number(form.get('stateId')) : undefined,
        cityId: form.get('cityId') ? Number(form.get('cityId')) : undefined,
        pincode: (form.get('pincode') as string) || undefined,
        mobile1: (form.get('mobile1') as string) || undefined,
        mobile2: (form.get('mobile2') as string) || undefined,
        esic: (form.get('esic') as string) || undefined,
        pf: (form.get('pf') as string) || undefined,
        panNo: (form.get('panNo') as string) || undefined,
        adharNo: (form.get('adharNo') as string) || undefined,
        cinNo: (form.get('cinNo') as string) || undefined,
        // Travel/Reporting Details
        airTravelClass: (form.get('airTravelClass') as string) || undefined,
        railwayTravelClass: (form.get('railwayTravelClass') as string) || undefined,
        busTravelClass: (form.get('busTravelClass') as string) || undefined,
        reporting1Id: form.get('reporting1Id') ? Number(form.get('reporting1Id')) : undefined,
        reporting2Id: form.get('reporting2Id') ? Number(form.get('reporting2Id')) : undefined,
        reportingSiteId: form.get('reportingSiteId') ? Number(form.get('reportingSiteId')) : undefined,
        reportingSiteAssignedDate: form.get('reportingSiteAssignedDate') ? String(form.get('reportingSiteAssignedDate')) : undefined,
        // Leave Details
        sickLeavesPerYear: form.get('sickLeavesPerYear') ? Number(form.get('sickLeavesPerYear')) : undefined,
        paidLeavesPerYear: form.get('paidLeavesPerYear') ? Number(form.get('paidLeavesPerYear')) : undefined,
        casualLeavesPerYear: form.get('casualLeavesPerYear') ? Number(form.get('casualLeavesPerYear')) : undefined,
        balanceSickLeaves: form.get('balanceSickLeaves') ? Number(form.get('balanceSickLeaves')) : undefined,
        balancePaidLeaves: form.get('balancePaidLeaves') ? Number(form.get('balancePaidLeaves')) : undefined,
        balanceCasualLeaves: form.get('balanceCasualLeaves') ? Number(form.get('balanceCasualLeaves')) : undefined,
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
      };
      parsedData = createSchema.parse(mapped);
    } else {
      const body = await req.json();
      parsedData = createSchema.parse(body);
    }

    // Function to persist image file
    async function saveImage(file: File, folder: 'profiles' | 'signatures') {
      if (!file || file.size === 0) return null as string | null;
      if (!file.type?.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('Image file too large (max 20MB)');
      }
      const ext = path.extname(file.name) || '.png';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'uploads', 'employees', folder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      return `/uploads/employees/${folder}/${filename}`;
    }

    const hashedPassword = await bcrypt.hash(parsedData.password, 10);

    // Create Employee and User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // save profile photo first if provided (signature handling deferred until DB field is added)
      const profilePhotoUrl = profilePic ? await saveImage(profilePic, 'profiles') : null;

      const user = await tx.user.create({
        data: {
          name: parsedData.name,
          email: parsedData.email,
          passwordHash: hashedPassword,
          role: parsedData.role,
          status: true,
          ...(profilePhotoUrl ? { profilePhoto: profilePhotoUrl } : {}),
        },
      });

      const employee = await tx.employee.create({
        data: {
          name: parsedData.name,
          // Relations via nested connect (avoid unknown argument errors on scalar FKs)
          ...(parsedData.departmentId != null
            ? { department: { connect: { id: parsedData.departmentId } } }
            : {}),
          ...(parsedData.stateId != null
            ? { state: { connect: { id: parsedData.stateId } } }
            : {}),
          ...(parsedData.cityId != null
            ? { city: { connect: { id: parsedData.cityId } } }
            : {}),
          ...(parsedData.reporting1Id != null
            ? { reporting1: { connect: { id: parsedData.reporting1Id } } }
            : {}),
          ...(parsedData.reporting2Id != null
            ? { reporting2: { connect: { id: parsedData.reporting2Id } } }
            : {}),
          ...(parsedData.reportingSiteId != null
            ? { reportingSite: { connect: { id: parsedData.reportingSiteId } } }
            : {}),
          resignDate: parsedData.resignDate || null,
          // Personal Details
          dateOfBirth: parsedData.dateOfBirth || null,
          anniversaryDate: parsedData.anniversaryDate || null,
          spouseName: parsedData.spouseName || null,
          bloodGroup: parsedData.bloodGroup || null,
          // Address Details
          addressLine1: parsedData.addressLine1 || null,
          addressLine2: parsedData.addressLine2 || null,
          pincode: parsedData.pincode || null,
          // Contact Details
          mobile1: parsedData.mobile1 || null,
          mobile2: parsedData.mobile2 || null,
          // Other Details
          esic: parsedData.esic || null,
          pf: parsedData.pf || null,
          panNo: parsedData.panNo || null,
          adharNo: parsedData.adharNo || null,
          cinNo: parsedData.cinNo || null,
          // Travel/Reporting Details
          airTravelClass: parsedData.airTravelClass || null,
          railwayTravelClass: parsedData.railwayTravelClass || null,
          busTravelClass: parsedData.busTravelClass || null,
          reportingSiteAssignedDate: parsedData.reportingSiteAssignedDate || null,
          // Leave Details
          sickLeavesPerYear: parsedData.sickLeavesPerYear || null,
          paidLeavesPerYear: parsedData.paidLeavesPerYear || null,
          casualLeavesPerYear: parsedData.casualLeavesPerYear || null,
          balanceSickLeaves: parsedData.balanceSickLeaves || null,
          balancePaidLeaves: parsedData.balancePaidLeaves || null,
          balanceCasualLeaves: parsedData.balanceCasualLeaves || null,
          // Link to user via relation
          user: { connect: { id: user.id } },
          // Files: signature is currently not persisted in DB; to be added via migration when field is introduced
        },
        select: {
          id: true,
          name: true,
          departmentId: true,
          resignDate: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              department: true,
            },
          },
        },
      });

      // Create SiteEmployee and SiteEmployeeLog records for each selected site
      if (parsedData.siteId && (Array.isArray(parsedData.siteId) ? parsedData.siteId.length > 0 : true)) {
        const sitesToAssign = Array.isArray(parsedData.siteId) ? parsedData.siteId : [parsedData.siteId];

        for (const siteId of sitesToAssign) {
          // Create SiteEmployee record
          await tx.siteEmployee.create({
            data: {
              siteId: siteId,
              employeeId: employee.id,
              assignedDate: new Date(),
              assignedById: auth.user.id,
            },
          });

          // Create SiteEmployeeLog record
          await tx.siteEmployeeLog.create({
            data: {
              siteId: siteId,
              employeeId: employee.id,
              assignedDate: new Date(),
              assignedById: auth.user.id,
            },
          });
        }
      }

      return { employee, user };
    });

    return Success(result.employee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create employee error:", error);
    return ApiError("Failed to create employee");
  }
}
