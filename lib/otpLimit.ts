import { prisma } from "@/lib/db";
import { getTodayInTimezone } from "@/lib/timezone";

const OTP_DAILY_LIMIT = 5;

function todayRange() {
    const start = getTodayInTimezone();
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/**
 * Check if a user has exceeded their daily OTP request limit.
 * Scans D_tblotp_log for records created today for the given user.
 *
 * @returns { allowed: boolean, count: number }
 */
export async function checkOtpDailyLimit(userId: string): Promise<{ allowed: boolean; count: number }> {
    const { start, end } = todayRange();

    const count = await prisma.d_tblotp_forgotpasswordlog.count({
        where: {
            user_id: userId,
            created_at: { gte: start, lte: end },
        },
    });

    return { allowed: count < OTP_DAILY_LIMIT, count };
}
