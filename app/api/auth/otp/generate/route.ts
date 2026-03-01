import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOtpDailyLimit } from "@/lib/otpLimit";

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

async function createIncidentIfMissing(userId: string, incidentType: "RECOVERY_LOCKED_OTP_LIMIT_EXCEEDED" | "ACCOUNT_LOCKED_LOGIN_FAILURE") {
  const dedupeKey =
    incidentType === "RECOVERY_LOCKED_OTP_LIMIT_EXCEEDED"
      ? `OTP_LOCK_${userId}` // keep <= 30 chars if possible
      : `RECOVERY_LOCK_${userId}`;

  // If an OPEN incident already exists for this dedupe key, do nothing
  const existing = await prisma.d_tblaccount_recovery_incident.findFirst({
    where: { dedupe_key: dedupeKey, status: "OPEN" },
    select: { incident_id: true },
  });

  if (existing) return;

  try {
    await prisma.d_tblaccount_recovery_incident.create({
      data: {
        user_id: userId,
        incident_type: incidentType,
        status: "OPEN",
        dedupe_key: dedupeKey,
        created_at: new Date(),
      },
    });
  } catch {
    // ignore unique/dedupe races
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const raw = (body?.email ?? body?.identifier ?? "").toString().trim().toLowerCase();

    await sleep(120);

    const generic = NextResponse.json(
      { message: "IF THE ACCOUNT IS ELIGIBLE, A VERIFICATION CODE WILL BE SENT." },
      { status: 200 }
    );

    if (!raw) return generic;

    const user = await prisma.d_tbluser.findFirst({
      where: { email: raw },
      select: { user_id: true },
    });

    // zero trust: generic
    if (!user?.user_id) {
      await sleep(120);
      return generic;
    }

    const userId = user.user_id;

    // Check auth state
    const auth = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userId },
      select: { is_disabled: true, question_attempts: true },
    });

    const isDisabled = !!auth?.is_disabled;
    const securityLocked = (auth?.question_attempts ?? 0) >= 3;

    // If security is already locked AND user is disabled → recovery exhausted → create incident
    if (isDisabled && securityLocked) {
      await createIncidentIfMissing(userId, "ACCOUNT_LOCKED_LOGIN_FAILURE");
      return generic;
    }

    // Daily OTP limit (5/day)
    const { allowed } = await checkOtpDailyLimit(userId);

    // If disabled + OTP limit exceeded → recovery exhausted → create incident
    if (isDisabled && !allowed) {
      await createIncidentIfMissing(userId, "RECOVERY_LOCKED_OTP_LIMIT_EXCEEDED");
      return generic;
    }

    // Normal OTP limit (non-disabled users)
    if (!allowed) {
      return generic; // Zero-trust pattern: return generic success but don't create OTP
    }

    // Normal OTP generation
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[AUTH] Recovery OTP for ${raw}: ${otpCode}`);

    await prisma.d_tblotp_log.create({
      data: {
        user_id: userId,
        otp_code: otpCode,
        created_at: new Date(),
        is_verified: false,
      },
    });

    return generic;
  } catch (error) {
    console.error("OTP Generate Error:", error);
    return NextResponse.json(
      { message: "IF THE ACCOUNT IS ELIGIBLE, A VERIFICATION CODE WILL BE SENT." },
      { status: 200 }
    );
  }
}
