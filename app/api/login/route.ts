import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookieOptions } from "@/lib/auth";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const password = (body?.password ?? "").toString();

    if (!email || !password) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const userProfile = await prisma.d_tbluser.findFirst({
      where: { email },
      select: {
        user_id: true,
        role_id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!userProfile) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const authRecord = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userProfile.user_id },
      select: {
        user_id: true,
        password_hash: true, // plain text currently
        is_first_login: true,
        failed_attempts: true,
        is_disabled: true,
      },
    });

    if (!authRecord || authRecord.is_disabled) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // ✅ plain text compare
    const stored = (authRecord.password_hash ?? "").toString();
    const ok = stored === password;

    if (!ok) {
      const attempts = (authRecord.failed_attempts ?? 0) + 1;

      if (attempts >= 3) {
        await prisma.d_tbluser_authentication.update({
          where: { user_id: userProfile.user_id },
          data: {
            failed_attempts: attempts,
            is_disabled: true,
            last_failed_attempt: new Date(),
          },
        });
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
      }

      await prisma.d_tbluser_authentication.update({
        where: { user_id: userProfile.user_id },
        data: { failed_attempts: attempts, last_failed_attempt: new Date() },
      });

      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // reset attempts
    await prisma.d_tbluser_authentication.update({
      where: { user_id: userProfile.user_id },
      data: { failed_attempts: 0, last_failed_attempt: null },
    });

    // First login flow
    if (authRecord.is_first_login) {
      return NextResponse.json({
        message: "Setup Required",
        user: {
          user_id: userProfile.user_id,
          role_id: userProfile.role_id,
          email: userProfile.email,
          name: userProfile.first_name ?? null,
        },
        isFirstLogin: true,
      });
    }

   const roleId = Number(userProfile.role_id ?? 0);

    // Current problematic line:
    // let redirect = roleId === 3 ? "/admin/dashboard" : "/employee/dashboard";

    // Fixed logic for Manager (Role 5):
    let redirect = "/employee/dashboard"; // Default

    if (roleId === 3) {
    redirect = "/admin/dashboard";
    } else if (roleId === 5) {
    redirect = "/manager/dashboard"; // ✅ Redirects Role 5 to Manager dashboard
    } else if (roleId === 4) {
    redirect = "/supervisor/dashboard"; // ✅ Redirects Role 4 to Supervisor dashboard
    }

    // ✅ Daily sentiment gate for employees
    if (roleId === 1) {
      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);

      const done = await prisma.d_tblsentiment_log.findFirst({
        where: {
          user_id: userProfile.user_id,
          created_at: { gte: dayStart, lte: dayEnd },
        },
        select: { sentiment_id: true },
      });

      if (!done) redirect = "/employee/sentiment";
    }

    // ✅ Create session cookie
    const token = await signSession({
      user_id: userProfile.user_id,
      role_id: roleId || null,
      name: userProfile.first_name ?? null,
      email: userProfile.email ?? null,
    });

    const res = NextResponse.json({
      message: "Login successful",
      user: {
        user_id: userProfile.user_id,
        role_id: roleId,
        name: userProfile.first_name ?? null,
        email: userProfile.email ?? null,
      },
      isFirstLogin: false,
      redirect,
    });

    const cookie = sessionCookieOptions();
    res.cookies.set(cookie.name, token, cookie);

    return res;
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
