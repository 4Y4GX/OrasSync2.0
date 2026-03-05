import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookieOptions } from "@/lib/auth";
import { verifyPassword, hashPassword, isBcryptHash } from "@/lib/password";

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
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({} as any));

    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const password = (body?.password ?? "").toString();

    if (!email || !password) {
      await hashPassword(password || "dummy");
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
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

    // Mask database query latency
    const queryUserId = userProfile ? userProfile.user_id : "00000000-0000-0000-0000-000000000000";
    const authRecord = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: queryUserId },
      select: {
        user_id: true,
        password_hash: true,
        is_first_login: true,
        failed_attempts: true,
        is_disabled: true,
      },
    });

    if (!userProfile || !authRecord || authRecord.is_disabled) {
      await hashPassword(password || "dummy");
      await prisma.d_tbluser_authentication.updateMany({
        where: { user_id: "00000000-0000-0000-0000-000000000000" },
        data: { last_failed_attempt: new Date() },
      });
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // ✅ bcrypt compare
    const stored = (authRecord.password_hash ?? "").toString();
    let ok: boolean;
    if (isBcryptHash(stored)) {
      ok = await verifyPassword(password, stored);
    } else {
      ok = stored === password;
      if (ok) {
        const hashed = await hashPassword(password);
        await prisma.d_tbluser_authentication.update({
          where: { user_id: userProfile.user_id },
          data: { password_hash: hashed },
        });
      }
    }

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
        await prisma.d_tbluser.update({
          where: { user_id: userProfile.user_id },
          data: { account_status: "DISABLED" },
        });
      } else {
        await prisma.d_tbluser_authentication.update({
          where: { user_id: userProfile.user_id },
          data: { failed_attempts: attempts, last_failed_attempt: new Date() },
        });
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // reset attempts
    await prisma.d_tbluser_authentication.update({
      where: { user_id: userProfile.user_id },
      data: { failed_attempts: 0, last_failed_attempt: null },
    });

    // First login flow
    if (authRecord.is_first_login) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
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

    // OTP VERIFICATION STEP
    const otp = (body?.otp ?? "").toString().trim();

    if (!otp) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`[AUTH] Login OTP for ${email}: ${otpCode}`);

      await prisma.d_tblotp_firsttimelog.create({
        data: {
          user_id: userProfile.user_id,
          otp_code: otpCode,
          created_at: new Date(),
          is_verified: false,
        },
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({
        message: "OTP Required",
        requiresOtp: true,
      });
    }

    // Second pass: OTP verify
    const latestLog = await prisma.d_tblotp_firsttimelog.findFirst({
      where: { user_id: userProfile.user_id },
      orderBy: { created_at: "desc" },
    });

    if (!latestLog || !latestLog.created_at || latestLog.is_verified) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Invalid or expired verification code." }, { status: 400 });
    }

    const expiryLimit = 90 * 1000;
    const timeElapsed = Date.now() - new Date(latestLog.created_at).getTime();
    if (timeElapsed > expiryLimit) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Verification code expired." }, { status: 400 });
    }

    const maxAttemptsPerOtp = 3;
    const otpAttempts = latestLog.attempts ?? 0;
    if (otpAttempts >= maxAttemptsPerOtp) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Too many attempts. Request a new code." }, { status: 400 });
    }

    if (latestLog.otp_code !== otp) {
      const nextAttempts = otpAttempts + 1;
      await prisma.d_tblotp_firsttimelog.update({
        where: { otp_id: latestLog.otp_id },
        data: { attempts: nextAttempts },
      });
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    await prisma.d_tblotp_firsttimelog.update({
      where: { otp_id: latestLog.otp_id },
      data: { is_verified: true },
    });

    const roleId = Number(userProfile.role_id ?? 0);
    let redirect = "/employee/dashboard";
    if (roleId === 2) redirect = "/analyst/dashboard";
    if (roleId === 3) redirect = "/admin/dashboard";
    if (roleId === 4) redirect = "/supervisor/dashboard";
    if (roleId === 5) redirect = "/manager/dashboard";

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

    const token = await signSession({
      user_id: userProfile.user_id,
      role_id: roleId || null,
      name: userProfile.first_name ?? null,
      email: userProfile.email ?? null,
    });

    let streakStats = null;
    if (roleId === 1) {
      streakStats = await prisma.d_tbluser_stats.findUnique({
        where: { user_id: userProfile.user_id },
      });
      if (!streakStats) {
        streakStats = await prisma.d_tbluser_stats.create({
          data: {
            user_id: userProfile.user_id,
            streak_count: 0,
            total_absences: 0,
          },
        });
      }
    }

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
      ...(roleId === 1 && streakStats ? { streak: streakStats.streak_count } : {}),
    });

    const cookie = sessionCookieOptions();
    res.cookies.set(cookie.name, token, cookie);

    const elapsed = Date.now() - startTime;
    if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
    return res;
  } catch (error) {
    console.error("Login API Error:", error);
    const elapsed = Date.now() - startTime;
    if (elapsed < 400) await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
