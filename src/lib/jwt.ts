// JWT utility module: signing & verification for access/refresh tokens + duration parsing helpers.
// Centralizes env access & prevents duplication across auth routes.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const encoder = new TextEncoder();

/**
 * Read an environment variable or throw if missing (unless fallback provided).
 */
export function getEnv(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env ${name}`);
}

// Added: shared duration parser
export function parseDurationMs(expr: string): number {
  const m = /^(\d+)(m|h|d)$/i.exec(expr);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return n;
  }
}

function getSecret(name: string) {
  return encoder.encode(getEnv(name));
}

export async function signAccessToken(payload: JWTPayload) {
  const secret = getSecret("JWT_ACCESS_SECRET");
  const expires = getEnv("JWT_ACCESS_EXPIRES", "15m");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret);
}

export async function signRefreshToken(payload: JWTPayload) {
  const secret = getSecret("JWT_REFRESH_SECRET");
  const expires = getEnv("JWT_REFRESH_EXPIRES", "30d");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret);
}

// Added helper: sign token and compute absolute expiry Date
export async function signRefreshTokenWithExpiry(payload: JWTPayload) {
  const expiresExpr = getEnv("JWT_REFRESH_EXPIRES", "30d");
  const token = await signRefreshToken(payload);
  const expiresAt = new Date(Date.now() + parseDurationMs(expiresExpr));
  return { token, expiresAt };
}

// New: allow supplying a custom expiry expression (e.g. "1d" for non-remember sessions)
export async function signRefreshTokenWithCustomExpiry(payload: JWTPayload, expiresExpr: string) {
  const secret = getSecret("JWT_REFRESH_SECRET");
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresExpr)
    .sign(secret);
  const expiresAt = new Date(Date.now() + parseDurationMs(expiresExpr));
  return { token, expiresAt };
}

export async function verifyAccessToken<T extends JWTPayload = JWTPayload>(token: string): Promise<T> {
  const secret = getSecret("JWT_ACCESS_SECRET");
  const { payload } = await jwtVerify(token, secret);
  return payload as T;
}

export async function verifyRefreshToken<T extends JWTPayload = JWTPayload>(token: string): Promise<T> {
  const secret = getSecret("JWT_REFRESH_SECRET");
  const { payload } = await jwtVerify(token, secret);
  return payload as T;
}
