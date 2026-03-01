import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { checkOtpDailyLimit } from "@/lib/otpLimit";

export async function POST() {
    try {
        const user = await getUserFromCookie();
        if (!user?.user_id) {
            return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
        }

        const userId = user.user_id;

        // Check if account is disabled
        const auth = await prisma.d_tbluser_authentication.findUnique({
            where: { user_id: userId },
            select: { is_disabled: true },
        });

        if (auth?.is_disabled) {
            return NextResponse.json({ message: "ACCOUNT_DISABLED" }, { status: 403 });
        }

        // Daily OTP limit (5/day)
        const { allowed, count: todayCount } = await checkOtpDailyLimit(userId);

        if (!allowed) {
            return NextResponse.json(
                { message: "OTP_LIMIT_REACHED", dailyCount: todayCount },
                { status: 429 }
            );
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[EMPLOYEE-CHANGE-PW] OTP for ${user.email ?? userId}: ${otpCode}`);

        await prisma.d_tblotp_log.create({
            data: {
                user_id: userId,
                otp_code: otpCode,
                created_at: new Date(),
                is_verified: false,
            },
        });

        return NextResponse.json({
            message: "OK",
            dailyCount: todayCount + 1,
        });
    } catch (error) {
        console.error("Employee Change-PW OTP Error:", error);
        return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 500 });
    }
}
