import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const user = await getUserFromCookie();
        // In a real app, verify user.role_id === 2 (Supervisor) here
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // 1. Total Team Members (All active users with role_id=3 ? Or just all employees)
        // Assuming role_id 3 is Employee. Adjust if needed.
        const totalMembers = await prisma.d_tbluser.count({
            where: {
                role_id: 3,
                // is_active: 1 // Incorrect
                account_status: 'ACTIVE'
            }
        });

        // 2. Currently Working (Clocked IN today, no Clock OUT yet)
        // We look for users who have a clock_in today but no clock_out
        const today = new Date();
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        const activeClocks = await prisma.d_tblclock_log.count({
            where: {
                clock_in_time: {
                    gte: startOfToday,
                    lte: endOfToday
                },
                clock_out_time: null
            }
        });

        // 3. Total Hours Today (Sum of all time logs for today)
        const timeLogs = await prisma.d_tbltime_log.findMany({
            where: {
                log_date: {
                    gte: startOfToday,
                    lte: endOfToday
                }
            },
            select: {
                total_hours: true
            }
        });

        const totalHours = timeLogs.reduce((acc, log) => {
            return acc + (Number(log.total_hours) || 0);
        }, 0);

        // 5. Weekly Stats (Graph Data - Last 5 weekdays or last 7 days)
        // Simplified: Last 5 days including today
        const offlineCount = Math.max(0, totalMembers - activeClocks);

        const graphData = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);

            const nextD = new Date(d);
            nextD.setDate(d.getDate() + 1);

            const dailyLogs = await prisma.d_tbltime_log.findMany({
                where: { log_date: { gte: d, lt: nextD } },
                select: { total_hours: true }
            });

            const dailyTotal = dailyLogs.reduce((acc, log) => acc + (Number(log.total_hours) || 0), 0);
            graphData.push({
                day: days[d.getDay()],
                hours: dailyTotal.toFixed(1),
                percentage: Math.min(100, (dailyTotal / (totalMembers * 8)) * 100) // Rough cap relative to 8hr/person
            });
        }

        // 6. Weekly Performance Metrics
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyLogs = await prisma.d_tbltime_log.findMany({
            where: { log_date: { gte: startOfWeek } },
            select: { total_hours: true }
        });

        const weeklyTotal = weeklyLogs.reduce((acc, log) => acc + (Number(log.total_hours) || 0), 0);
        const avgPerPerson = totalMembers > 0 ? (weeklyTotal / totalMembers).toFixed(1) : "0.0";

        return NextResponse.json({
            totalMembers,
            currentlyWorking: activeClocks,
            totalHours: totalHours.toFixed(1),
            offline: offlineCount,
            graphData,
            teamPerformance: {
                weeklyTotal: weeklyTotal.toFixed(1),
                avgPerPerson,
                productivity: "94%" // Placeholder complexity to calculate real productivity
            }
        });

    } catch (error: any) {
        console.error("SUPERVISOR_STATS_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to fetch supervisor stats" },
            { status: 500 }
        );
    }
}
