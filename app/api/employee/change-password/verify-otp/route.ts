import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { createRecoveryToken, recoveryCookieName } from "@/lib/recoverySession";

export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user?.user_id) {
            return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
        }

        const userId = user.user_id;
        const body = await request.json().catch(() => ({} as any));
        const otp = (body?.otp ?? "").toString().trim();

        if (!otp) {
            return NextResponse.json({ message: "OTP_REQUIRED" }, { status: 400 });
        }

        // Get latest OTP for this user
        const latestLog = await prisma.d_tblotp_log.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
        });

        if (!latestLog || !latestLog.created_at) {
            return NextResponse.json({ message: "NO_OTP_FOUND" }, { status: 400 });
        }

        // Check 90-second expiry
        const expiryMs = 90 * 1000;
        const elapsed = Date.now() - new Date(latestLog.created_at).getTime();
        if (elapsed > expiryMs) {
            return NextResponse.json({ message: "OTP_EXPIRED" }, { status: 400 });
        }

        // Check if already verified
        if (latestLog.is_verified) {
            return NextResponse.json({ message: "OTP_ALREADY_USED" }, { status: 400 });
        }

        // Check max 3 attempts per OTP
        const attempts = latestLog.attempts ?? 0;
        if (attempts >= 3) {
            return NextResponse.json(
                { message: "MAX_ATTEMPTS_REACHED", attempts: 3, maxAttempts: 3 },
                { status: 400 }
            );
        }

        // Verify OTP
        if (latestLog.otp_code !== otp) {
            const nextAttempts = attempts + 1;
            try {
                await prisma.d_tblotp_log.update({
                    where: { otp_id: latestLog.otp_id },
                    data: { attempts: nextAttempts },
                });
            } catch { }

            return NextResponse.json(
                {
                    message: "INVALID_OTP",
                    attempts: nextAttempts,
                    maxAttempts: 3,
                },
                { status: 400 }
            );
        }

        // OTP is correct — mark as verified
        await prisma.d_tblotp_log.update({
            where: { otp_id: latestLog.otp_id },
            data: { is_verified: true },
        });

        // Reset security-question attempt counter for fresh run
        try {
            await prisma.d_tbluser_authentication.update({
                where: { user_id: userId },
                data: { question_attempts: 0 },
            });
        } catch { }

        // Create recovery token at OTP_VERIFIED stage
        const token = createRecoveryToken({ userId, stage: "OTP_VERIFIED" });

        const res = NextResponse.json({ message: "OK" });
        res.cookies.set(recoveryCookieName(), token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        return res;
    } catch (error) {
        console.error("Employee Verify-OTP Error:", error);
        return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 500 });
    }
}
