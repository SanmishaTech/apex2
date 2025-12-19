import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import bcrypt from "bcryptjs";

// GET /api/me - current user's profile
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const me = await prisma.user.findUnique({
      where: { id: Number(auth.user.id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!me) return Error("User not found", 404);
    return Success(me);
  } catch (e) {
    return Error("Failed to fetch profile");
  }
}

// PATCH /api/me - update current user's profile
// Body: { name?, email?, password?, confirmPassword? }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  const { name, email, password, confirmPassword } = (body || {}) as {
    name?: string | null;
    email?: string | null;
    password?: string | null;
    confirmPassword?: string | null;
  };

  const data: Record<string, any> = {};
  if (typeof name === "string") data.name = name || null;
  if (typeof email === "string") data.email = email;

  if (password !== undefined || confirmPassword !== undefined) {
    if (!password) return Error("Password is required", 400);
    if (password !== confirmPassword) return Error("Passwords do not match", 400);
    if (password.length < 6) return Error("Password must be at least 6 characters", 400);
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) return Error("Nothing to update", 400);

  try {
    const updated = await prisma.user.update({
      where: { id: Number(auth.user.id) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    return Success(updated);
  } catch (e: any) {
    if (e?.code === "P2002") return Error("Email already exists", 409);
    return Error("Failed to update profile");
  }
}
