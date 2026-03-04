import { prisma } from "@/lib/db";
import { getManilaTimeComponents } from "@/lib/timezone";

const OTP_DAILY_LIMIT = 5;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

function todayRange() {
    const { year, month, day } = getManilaTimeComponents();
    // Manila 00:00:00 → subtract 8 h to get the UTC equivalent
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - MANILA_OFFSET_MS);
    // Manila 23:59:59.999 → subtract 8 h to get the UTC equivalent
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - MANILA_OFFSET_MS);
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
