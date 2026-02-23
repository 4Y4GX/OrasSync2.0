import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10);
        const user = await getUserFromCookie();
        if (!user || (user.role_id !== 4 && user.role_id !== 3 && user.role_id !== 2)) {
            return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
        }

        // Get team members for supervisor (same logic as team status)
        let teamMembers;
        if (user.role_id === 4) {
            // Supervisor: only their own team
            teamMembers = await prisma.d_tbluser.findMany({
                where: {
                    supervisor_id: user.user_id,
                    account_status: "ACTIVE",
                    role_id: 1,
                },
                select: { user_id: true },
            });
        } else {
            // Manager/Admin: all employees
            teamMembers = await prisma.d_tbluser.findMany({
                where: {
                    role_id: 1,
                    account_status: "ACTIVE",
                },
                select: { user_id: true },
            });
        }
        const teamIds = teamMembers.map((m: any) => m.user_id);

        // Today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // Get all clock logs for today for team
        const clocks = await prisma.d_tblclock_log.findMany({
            where: {
                user_id: { in: teamIds },
                shift_date: { gte: today, lt: tomorrow },
            },
        });

        // Get all time logs for today for team
        const timeLogs = await prisma.d_tbltime_log.findMany({
            where: {
                user_id: { in: teamIds },
                log_date: { gte: today, lt: tomorrow },
            },
        });

        // Calculate stats
        const totalMembers = teamIds.length;
        let currentlyWorking = 0;
        let offline = 0;
        let totalHours = 0;
        for (const id of teamIds) {
            const userClocks = clocks.filter(c => c.user_id === id);
            const isWorking = userClocks.some(c => !c.clock_out_time);
            if (isWorking) currentlyWorking++;
            else offline++;
            const userLogs = timeLogs.filter(l => l.user_id === id);
            totalHours += userLogs.reduce((sum, l) => sum + (l.total_hours?.toNumber() || 0), 0);
        }

        // Weekly stats for graph and performance
        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (weekOffset * 7));
        startOfWeek.setHours(0, 0, 0, 0);
        const weekEnd = new Date(startOfWeek);
        weekEnd.setDate(startOfWeek.getDate() + 7);

        const weekLogs = await prisma.d_tbltime_log.findMany({
            where: {
                user_id: { in: teamIds },
                log_date: { gte: startOfWeek, lt: weekEnd },
            },
        });

        // Graph data: hours per day
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const graphData = Array(7).fill(0).map((_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            const logs = weekLogs.filter(l => {
                if (!l.log_date) return false;
                const logDate = l.log_date instanceof Date ? l.log_date : new Date(l.log_date);
                return logDate.getFullYear() === d.getFullYear() && logDate.getMonth() === d.getMonth() && logDate.getDate() === d.getDate();
            });
            const hours = logs.reduce((sum, l) => sum + (l.total_hours?.toNumber() || 0), 0);
            const percentage = totalMembers > 0 ? Math.min(100, Math.max(5, (hours / (totalMembers * 8)) * 100)) : 0;
            return {
                day: days[d.getDay()],
                hours: hours.toFixed(1),
                percentage,
            };
        });

        // Weekly performance
        const weeklyTotal = weekLogs.reduce((sum, l) => sum + (l.total_hours?.toNumber() || 0), 0);
        const avgPerPerson = totalMembers > 0 ? (weeklyTotal / totalMembers).toFixed(1) : '0.0';
        const productivity = totalMembers > 0 ? Math.min(100, (weeklyTotal / (totalMembers * 40)) * 100).toFixed(0) : '0';

        const response = {
            totalMembers,
            currentlyWorking,
            totalHours: totalHours.toFixed(1),
            offline,
            graphData,
            teamPerformance: {
                weeklyTotal: weeklyTotal.toFixed(1),
                avgPerPerson,
                productivity: `${productivity}%`
            }
        };
        return NextResponse.json(response);
    } catch (error: any) {
        console.error("SUPERVISOR_STATS_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to fetch stats", error: error.message },
            { status: 500 }
        );
    }
}
