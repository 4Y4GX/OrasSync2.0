import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRecoveryToken, recoveryCookieName } from "@/lib/recoverySession";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function createOtpExhaustedIncidentIfMissing(userId: string) {
  const dedupeKey = `OTP_LOCK_${userId}`;

  const existing = await prisma.d_tblaccount_recovery_incident.findFirst({
    where: { dedupe_key: dedupeKey, status: "OPEN" },
    select: { incident_id: true },
  });

  if (existing) return;

  try {
    await prisma.d_tblaccount_recovery_incident.create({
      data: {
        user_id: userId,
        incident_type: "RECOVERY_LOCKED_OTP_LIMIT_EXCEEDED",
        status: "OPEN",
        dedupe_key: dedupeKey,
        created_at: new Date(),
      },
    });
  } catch {
    // ignore
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const email = (body?.email ?? "").toString().trim();
    const otp = (body?.otp ?? "").toString().trim();
    const flow = (body?.flow ?? "").toString().trim(); // "recovery" when forgot-password

    if (!email || !otp) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const user = await prisma.d_tbluser.findFirst({
      where: { email },
      select: { user_id: true },
    });

    if (!user?.user_id) {
      await sleep(120);
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const userId = user.user_id;

    const auth = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userId },
      select: { is_disabled: true },
    });

    const latestLog = await prisma.d_tblotp_log.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    if (!latestLog || !latestLog.created_at) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const expiryLimit = 90 * 1000;
    const timeElapsed = Date.now() - new Date(latestLog.created_at).getTime();
    if (timeElapsed > expiryLimit) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const maxAttemptsPerOtp = 5;
    const attempts = latestLog.attempts ?? 0;

    if (latestLog.is_verified) {
      await sleep(150);
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    if (attempts >= maxAttemptsPerOtp) {
      if (auth?.is_disabled) {
        const { start, end } = todayRange();

        const exhaustedCountToday = await prisma.d_tblotp_log.count({
          where: {
            user_id: userId,
            created_at: { gte: start, lte: end },
            is_verified: false,
            attempts: { gte: maxAttemptsPerOtp },
          },
        });

        if (exhaustedCountToday >= 5) {
          await createOtpExhaustedIncidentIfMissing(userId);
        }
      }

      await sleep(200);
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    if (latestLog.otp_code !== otp) {
      const nextAttempts = attempts + 1;

      try {
        await prisma.d_tblotp_log.update({
          where: { otp_id: latestLog.otp_id },
          data: { attempts: nextAttempts },
        });
      } catch {}

      if (nextAttempts >= maxAttemptsPerOtp && auth?.is_disabled) {
        const { start, end } = todayRange();

        const exhaustedCountToday = await prisma.d_tblotp_log.count({
          where: {
            user_id: userId,
            created_at: { gte: start, lte: end },
            is_verified: false,
            attempts: { gte: maxAttemptsPerOtp },
          },
        });

        if (exhaustedCountToday >= 5) {
          await createOtpExhaustedIncidentIfMissing(userId);
        }
      }

      await sleep(300);
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    if (flow === "recovery") {
      const answersCount = await prisma.d_tbluser_security_answers.count({
        where: { user_id: userId },
      });

      if (answersCount === 0) {
        await sleep(120);
        return NextResponse.json({ message: "REQUEST FAILED" }, { status: 403 });
      }
    }

    await prisma.d_tblotp_log.update({
      where: { otp_id: latestLog.otp_id },
      data: { is_verified: true },
    });

    // ✅ OPTIONAL but recommended: reset security-question attempt counter for a fresh recovery run
    // (This is NOT stage; it’s only attempt counting.)
    try {
      await prisma.d_tbluser_authentication.update({
        where: { user_id: userId },
        data: { question_attempts: 0 },
      });
    } catch {}

    const res = NextResponse.json({ message: "OK" }, { status: 200 });

    if (flow === "recovery") {
      // ✅ Stage starts at OTP_VERIFIED (never QUESTION_VERIFIED here)
      const token = createRecoveryToken({ userId, stage: "OTP_VERIFIED" });

      res.cookies.set(recoveryCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 10 * 60,
      });
    }

    return res;
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return NextResponse.json({ message: "REQUEST FAILED" }, { status: 500 });
  }
}
