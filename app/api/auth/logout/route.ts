// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });

  // Clear cookie by overwriting with maxAge=0
  const opts = sessionCookieOptions();
  res.cookies.set(opts.name, "", {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: 0,
  });

  logAudit({
    type: "audit",
    event: "LOGOUT",
    color: "neutral",
    data: {
      action: "User Logged Out"
    }
  });

  return res;
}
