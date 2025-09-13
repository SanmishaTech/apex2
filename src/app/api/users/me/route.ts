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
        role: true,
        profilePhoto: true,
        status: true,
        lastLogin: true,
      },
    });

    if (!user) {
      return Error("User not found", 404);
    }

    return Success(user);
  } catch (err) {
    console.error("Me endpoint error:", err);
    // This will catch expired tokens, invalid tokens, etc.
    return Unauthorized("Invalid access token");
  }
}
