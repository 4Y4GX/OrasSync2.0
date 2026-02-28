// app/api/supervisor/settings/change-password/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STRONG_PASS_REGEX, passwordChecks } from "@/lib/zeroTrustValidation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 2) {
      return NextResponse.json(
        { message: "Unauthorized. Supervisor access required." },
        { status: 403 }
      );
    }

    const { new_password } = await request.json().catch(() => ({}));

    // Basic Validation
    if (!new_password) {
      return NextResponse.json(
        { message: "New password is required" },
        { status: 400 }
      );
    }

    // Strong Password Validation
    const pwChecks = passwordChecks(new_password);
    if (!pwChecks.strongOk || !STRONG_PASS_REGEX.test(pwChecks.pw)) {
      return NextResponse.json(
        { message: "Password does not meet complexity requirements." },
        { status: 400 }
      );
    }

    const userId = user.user_id;

    // Gate 1: Check for a recently verified OTP (last 15 minutes)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const verifiedOtp = await prisma.d_tblotp_log.findFirst({
      where: {
        user_id: userId,
        is_verified: true,
        created_at: { gte: fifteenMinsAgo },
      },
      orderBy: { created_at: "desc" },
    });

    if (!verifiedOtp) {
      return NextResponse.json(
        { message: "OTP verification required." },
        { status: 403 }
      );
    }

    // Gate 2: Check that security question was verified successfully
    // (A successful verification sets question_attempts to 0)
    const userAuth = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userId },
      select: { question_attempts: true, is_disabled: true },
    });

    if (!userAuth || userAuth.is_disabled || (userAuth.question_attempts ?? 0) > 0) {
      return NextResponse.json(
        { message: "Security question verification required." },
        { status: 403 }
      );
    }

    // Update password_hash in auth table (No hashing per user instructions)
    await prisma.d_tbluser_authentication.update({
      where: { user_id: userId },
      data: { password_hash: pwChecks.pw },
    });

    // Consume the OTP so it can't be used again
    await prisma.d_tblotp_log.update({
      where: { otp_id: verifiedOtp.otp_id },
      data: { is_verified: false }, // marking false to consume it
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: userId,
        action_type: "CHANGE_PASSWORD",
        table_affected: "D_tbluser",
        old_value: "OTP and Security Question verified",
        new_value: "Password updated successfully",
      },
    });

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 }
    );
  }
}
