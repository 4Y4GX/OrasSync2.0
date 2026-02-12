import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recoveryCookieName, verifyRecoveryToken, upgradeRecoveryTokenStage } from "@/lib/recoverySession";

async function createIncidentIfMissing(userId: string) {
  const dedupeKey = `RECOVERY_LOCK_${userId}`;

  const existing = await prisma.d_tblaccount_recovery_incident.findFirst({
    where: { dedupe_key: dedupeKey, status: "OPEN" },
    select: { incident_id: true },
  });

  if (existing) return;

  try {
    await prisma.d_tblaccount_recovery_incident.create({
      data: {
        user_id: userId,
        incident_type: "ACCOUNT_LOCKED_SECURITY_QUESTION_FAILURE",
        status: "OPEN",
        dedupe_key: dedupeKey,
        created_at: new Date(),
      },
    });
  } catch { }
}

// POST: Verify answer using recovery session
export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((p) => p.startsWith(`${recoveryCookieName()}=`));

    const token = tokenMatch ? decodeURIComponent(tokenMatch.split("=").slice(1).join("=")) : null;
    const session = verifyRecoveryToken(token);

    if (!session?.userId) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 401 });
    }

    // ✅ Must be at OTP_VERIFIED before answering question
    if (session.stage !== "OTP_VERIFIED") {
      // If already QUESTION_VERIFIED, allow idempotent OK
      if (session.stage === "QUESTION_VERIFIED") {
        return NextResponse.json({ message: "OK" }, { status: 200 });
      }
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 403 });
    }

    const { questionId, answer } = await request.json().catch(() => ({}));
    if (!questionId || typeof answer !== "string") {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const userId = session.userId;

    const userAuth = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userId },
      select: { question_attempts: true, is_disabled: true },
    });

    if (!userAuth) return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });

    const currentAttempts = userAuth.question_attempts ?? 0;

    if (currentAttempts >= 3) {
      if (userAuth.is_disabled) await createIncidentIfMissing(userId);
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 403 });
    }

    const correctAnswer = await prisma.d_tbluser_security_answers.findFirst({
      where: { user_id: userId, question_id: Number(questionId) },
      select: { answer_hash: true },
    });

    const ok = !!correctAnswer && correctAnswer.answer_hash === answer;

    if (!ok) {
      const nextAttempts = currentAttempts + 1;

      await prisma.d_tbluser_authentication.update({
        where: { user_id: userId },
        data: { question_attempts: nextAttempts },
      });

      if (nextAttempts >= 3 && userAuth.is_disabled) {
        await createIncidentIfMissing(userId);
      }

      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 401 });
    }

    // ✅ Success: reset attempt counter (NOT stage)
    await prisma.d_tbluser_authentication.update({
      where: { user_id: userId },
      data: { question_attempts: 0 },
    });

    // ✅ Upgrade cookie stage to QUESTION_VERIFIED
    const upgraded = upgradeRecoveryTokenStage(token, "QUESTION_VERIFIED");
    if (!upgraded) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 401 });
    }

    const res = NextResponse.json({ message: "OK" }, { status: 200 });
    res.cookies.set(recoveryCookieName(), upgraded, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60, // keep it 10 mins; upgradeRecoveryTokenStage keeps remaining time anyway
    });

    return res;
  } catch (error) {
    console.error("Error verifying answer:", error);
    return NextResponse.json({ message: "REQUEST FAILED" }, { status: 500 });
  }
}
