import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { Success, Error, Unauthorized } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;

  if (!accessToken) {
    return Unauthorized("No access token provided");
  }

  try {
    const decoded = await verifyAccessToken<{ sub: string }>(accessToken);
    const userId = decoded.sub;

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        profilePhoto: true,
        status: true,
        lastLogin: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: {
                    permission: { select: { permissionName: true } },
                  },
                },
              },
            },
          },
        },
        userPermissions: {
          select: {
            permission: { select: { permissionName: true } },
          },
        },
      },
    });

    if (!user) {
      return Error("User not found", 404);
    }

    const roleName = user.userRoles?.[0]?.role?.name ?? null;
    const rolePerms =
      user.userRoles?.[0]?.role?.permissions
        ?.map((rp) => rp.permission.permissionName)
        .filter(Boolean) ?? [];
    const userPerms =
      user.userPermissions
        ?.map((up) => up.permission.permissionName)
        .filter(Boolean) ?? [];

    const permissions = Array.from(new Set([...rolePerms, ...userPerms]));
    return Success({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleName,
      profilePhoto: user.profilePhoto,
      status: user.status,
      lastLogin: user.lastLogin,
      permissions,
    });
  } catch (err) {
    console.error("Me endpoint error:", err);
    // This will catch expired tokens, invalid tokens, etc.
    return Unauthorized("Invalid access token");
  }
}
