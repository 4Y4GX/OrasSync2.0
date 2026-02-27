import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayRange() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export async function POST() {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = user.user_id;

        // Check daily OTP limit (5 per day)
        const { start, end } = todayRange();
        const todayCount = await prisma.d_tblotp_log.count({
            where: { user_id: userId, created_at: { gte: start, lte: end } },
        });

        if (todayCount >= 5) {
            return NextResponse.json(
                { message: "OTP_LIMIT_REACHED", dailyCount: todayCount },
                { status: 429 }
            );
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[CHANGE-PW] Generated OTP for ${userId}: ${otpCode}`);

        await prisma.d_tblotp_log.create({
            data: {
                user_id: userId,
                otp_code: otpCode,
                created_at: new Date(),
                is_verified: false,
                attempts: 0,
            },
        });

        return NextResponse.json({
            message: "OTP_SENT",
            dailyCount: todayCount + 1,
        });
    } catch (error) {
        console.error("Change password OTP error:", error);
        return NextResponse.json(
            { message: "Failed to generate OTP" },
            { status: 500 }
        );
    }
}
