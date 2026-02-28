import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRecoveryToken, recoveryCookieName } from "@/lib/recoverySession";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = user.user_id;
        const body = await request.json().catch(() => ({} as any));
        const otp = (body?.otp ?? "").toString().trim();

        if (!otp) {
            return NextResponse.json({ message: "OTP is required" }, { status: 400 });
        }

        // Get latest OTP for this user
        const latestLog = await prisma.d_tblotp_log.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
        });

        if (!latestLog || !latestLog.created_at) {
            return NextResponse.json({ message: "NO_OTP_FOUND" }, { status: 400 });
        }

        // Check expiry (90 seconds)
        const expiryLimit = 90 * 1000;
        const timeElapsed = Date.now() - new Date(latestLog.created_at).getTime();
        if (timeElapsed > expiryLimit) {
            return NextResponse.json({ message: "OTP_EXPIRED" }, { status: 400 });
        }

        // Check if already verified
        if (latestLog.is_verified) {
            return NextResponse.json({ message: "OTP_ALREADY_USED" }, { status: 400 });
        }

        // Check attempts (max 3)
        const attempts = latestLog.attempts ?? 0;
        if (attempts >= 3) {
            return NextResponse.json(
                { message: "OTP_MAX_ATTEMPTS", attempts },
                { status: 400 }
            );
        }

        // Verify OTP
        if (latestLog.otp_code !== otp) {
            const nextAttempts = attempts + 1;

            await prisma.d_tblotp_log.update({
                where: { otp_id: latestLog.otp_id },
                data: { attempts: nextAttempts },
            });

            return NextResponse.json(
                { message: "OTP_INVALID", attempts: nextAttempts },
                { status: 400 }
            );
        }

        // OTP correct — mark as verified
        await prisma.d_tblotp_log.update({
            where: { otp_id: latestLog.otp_id },
            data: { is_verified: true },
        });

        // Reset security question attempts for a fresh run
        try {
            await prisma.d_tbluser_authentication.update({
                where: { user_id: userId },
                data: { question_attempts: 0 },
            });
        } catch { }

        // Create recovery token with OTP_VERIFIED stage
        const token = createRecoveryToken({ userId, stage: "OTP_VERIFIED" });

        const res = NextResponse.json({ message: "OTP_VERIFIED" });
        res.cookies.set(recoveryCookieName(), token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        return res;
    } catch (error) {
        console.error("Change password verify OTP error:", error);
        return NextResponse.json(
            { message: "Failed to verify OTP" },
            { status: 500 }
        );
    }
}
