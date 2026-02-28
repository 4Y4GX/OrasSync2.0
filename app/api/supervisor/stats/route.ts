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

        let teamMembers;
        if (user.role_id === 4 || user.role_id === 2) {
            teamMembers = await prisma.d_tbluser.findMany({
                where: {
                    supervisor_id: user.user_id,
                    account_status: "ACTIVE",
                    role_id: 1,
                },
                select: { user_id: true, first_name: true, last_name: true },
            });
        } else {
            teamMembers = await prisma.d_tbluser.findMany({
                where: { role_id: 1, account_status: "ACTIVE" },
                select: { user_id: true, first_name: true, last_name: true },
            });
        }

        const teamIds = teamMembers.map((m: any) => m.user_id);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const clocks = await prisma.d_tblclock_log.findMany({
            where: { user_id: { in: teamIds }, shift_date: { gte: today, lt: tomorrow } },
        });

        const timeLogs = await prisma.d_tbltime_log.findMany({
            where: { user_id: { in: teamIds }, log_date: { gte: today, lt: tomorrow } },
        });

        const totalMembers = teamIds.length;
        let currentlyWorking = 0;
        let offline = 0;
        let totalHoursToday = 0;

        for (const id of teamIds) {
            const userClocks = clocks.filter(c => c.user_id === id);
            const isWorking = userClocks.some(c => !c.clock_out_time);
            if (isWorking) currentlyWorking++;
            else offline++;
            const userLogs = timeLogs.filter(l => l.user_id === id);
            totalHoursToday += userLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);
        }

        // WEEKLY LOGIC (ISO: Monday = start of week)
        const startOfWeek = new Date(today);
        const dayOfWeek = startOfWeek.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // shift to Monday
        startOfWeek.setDate(startOfWeek.getDate() + mondayOffset + (weekOffset * 7));
        startOfWeek.setHours(0, 0, 0, 0);
        const weekEnd = new Date(startOfWeek);
        weekEnd.setDate(startOfWeek.getDate() + 7);

        const weekLogs = await prisma.d_tbltime_log.findMany({
            where: { user_id: { in: teamIds }, log_date: { gte: startOfWeek, lt: weekEnd } },
        });

        const weeklyTotal = weekLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);
        const targetWeeklyHours = totalMembers * 40; // Assuming 40 hours per member
        const productivity = targetWeeklyHours > 0 ? Math.min(100, (weeklyTotal / targetWeeklyHours) * 100).toFixed(0) : '0';

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const graphData = Array(7).fill(0).map((_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);

            const logs = weekLogs.filter(l => {
                if (!l.log_date) return false;
                const logDate = l.log_date instanceof Date ? l.log_date : new Date(l.log_date);
                return logDate.getFullYear() === d.getFullYear() &&
                    logDate.getMonth() === d.getMonth() &&
                    logDate.getDate() === d.getDate();
            });

            const hours = logs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);
            const percentage = totalMembers > 0 ? Math.min(100, (hours / (totalMembers * 8)) * 100) : 0;

            return {
                day: days[i],
                hours: hours.toFixed(1),
                percentage: percentage,
            };
        });

        // MONTHLY LOGIC
        const startOfMonth = new Date(today.getFullYear(), today.getMonth() + (weekOffset === 0 ? 0 : weekOffset / 4), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1 + (weekOffset === 0 ? 0 : weekOffset / 4), 0);

        const monthLogs = await prisma.d_tbltime_log.findMany({
            where: { user_id: { in: teamIds }, log_date: { gte: startOfMonth, lt: endOfMonth } },
        });
        const monthlyTotal = monthLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);

        // COMPLIANCE DATA
        const complianceData = teamMembers.map((member: any) => {
            const memberWeekLogs = weekLogs.filter(l => l.user_id === member.user_id);
            const memberTodayLogs = timeLogs.filter(l => l.user_id === member.user_id);
            const weekHrs = memberWeekLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);
            const todayHrs = memberTodayLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);

            return {
                name: `${member.first_name} ${member.last_name}`,
                todayHours: todayHrs.toFixed(1),
                weeklyHours: weekHrs.toFixed(1),
                isOverDaily: todayHrs > 8,
                isOverWeekly: weekHrs > 40
            };
        });

        return NextResponse.json({
            totalMembers,
            currentlyWorking,
            offline,
            totalHours: totalHoursToday.toFixed(1),
            graphData,
            complianceData,
            teamPerformance: {
                weeklyTotal: weeklyTotal.toFixed(1),
                monthlyTotal: monthlyTotal.toFixed(1),
                targetWeeklyHours: targetWeeklyHours,
                avgPerPerson: totalMembers > 0 ? (weeklyTotal / totalMembers).toFixed(1) : '0.0',
                productivity: `${productivity}%`
            }
        });
    } catch (error: any) {
        console.error("SUPERVISOR_STATS_ERROR:", error);
        return NextResponse.json({ message: "Failed to fetch stats" }, { status: 500 });
    }
}