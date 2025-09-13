import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  signAccessToken,
  signRefreshTokenWithExpiry,
  signRefreshTokenWithCustomExpiry,
  getEnv,
  parseDurationMs,
} from "@/lib/jwt";
import {
  Error,
  BadRequest,
  Unauthorized,
  Forbidden,
} from "@/lib/api-response";
import { serialize } from "cookie";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  remember: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
  const { email, password, remember } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return Unauthorized();
    }

    if (!user.status) {
      return Forbidden("User account is inactive");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return Unauthorized();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const refreshExpr = remember
      ? getEnv("JWT_REFRESH_EXPIRES", "30d")
      : getEnv("JWT_REFRESH_EXPIRES_SHORT", "1d");
    const [accessToken, { token: refreshToken, expiresAt: refreshTokenExpiresAt }] = await Promise.all([
      signAccessToken({ sub: String(user.id), role: user.role }),
      remember
        ? signRefreshTokenWithExpiry({ sub: String(user.id), role: user.role })
        : signRefreshTokenWithCustomExpiry({ sub: String(user.id), role: user.role }, refreshExpr),
    ]);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    const clientType = req.headers.get("x-client-type");

    if (clientType === "mobile") {
      // For mobile clients, return tokens in the response body
      return NextResponse.json({
        id: user.id,
        email: user.email,
        role: user.role,
        accessToken,
        refreshToken,
      });
    }

    // For web clients, set tokens in HttpOnly cookies
    const accessTokenMaxAge =
      parseDurationMs(getEnv("JWT_ACCESS_EXPIRES", "15m")) / 1000;

    const accessTokenCookie = serialize("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "strict",
      maxAge: accessTokenMaxAge,
    });

    const refreshTokenCookie = serialize("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "strict",
      expires: refreshTokenExpiresAt,
    });

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    response.headers.append("Set-Cookie", accessTokenCookie);
    response.headers.append("Set-Cookie", refreshTokenCookie);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Login error:", error);
    return Error("Internal server error");
  }
}
