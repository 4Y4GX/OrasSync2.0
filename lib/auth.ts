// lib/auth.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

export type SessionUser = {
  user_id: string;
  role_id: number | null;
  role_name?: string | null;
  name?: string | null;
  email?: string | null;
};

const COOKIE_NAME = "timea_session";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Keep dev fallback ONLY if you really want; better to require JWT_SECRET always.
    throw new Error("JWT_SECRET is missing. Add it to .env.local");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  const secret = getSecretKey();

  const payload: JWTPayload = {
    sub: user.user_id, // standard subject
    user_id: user.user_id,
    role_id: user.role_id ?? null,
    role_name: user.role_name ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser> {
  const secret = getSecretKey();
  const { payload } = await jwtVerify(token, secret);

  const user_id = String(payload.user_id ?? payload.sub ?? "").trim();
  const roleRaw = payload.role_id;

  const role_id =
    roleRaw === null || roleRaw === undefined ? null : Number(roleRaw);

  if (!user_id) throw new Error("Invalid session token: missing user_id");

  return {
    user_id,
    role_id: Number.isNaN(role_id as number) ? null : role_id,
    role_name: (payload.role_name ?? null) as string | null,
    name: (payload.name ?? null) as string | null,
    email: (payload.email ?? null) as string | null,
  };
}

export async function getUserFromCookie(): Promise<SessionUser | null> {
  // ✅ FIX: cookies() is async in your Next.js version
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
