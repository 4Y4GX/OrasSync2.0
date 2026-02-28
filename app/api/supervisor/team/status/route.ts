import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getUserFromCookie();
        if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
            return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
        }

        // Get team members for supervisor
        let teamMembers;
        if (user.role_id === 4) {
            // Supervisor: get ONLY their team members
            console.log('[DEBUG_SUPERVISOR_USER]', user);
            teamMembers = await prisma.d_tbluser.findMany({
                where: {
                    supervisor_id: user.user_id,
                    account_status: "ACTIVE",
                    role_id: 1, // Only employees
                },
                select: {
                    user_id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    D_tbldepartment: { select: { dept_name: true } },
                    D_tblteam: { select: { team_name: true } },
                    D_tblposition: { select: { pos_name: true } },
                },
                orderBy: { first_name: "asc" },
            });
            console.log('[DEBUG_SUPERVISOR_TEAM_MEMBERS]', teamMembers);
        } else {
            // Manager/Admin: get all employees
            teamMembers = await prisma.d_tbluser.findMany({
                where: {
                    role_id: 1,
                    account_status: "ACTIVE",
                },
                select: {
                    user_id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    D_tbldepartment: { select: { dept_name: true } },
                    D_tblteam: { select: { team_name: true } },
                    D_tblposition: { select: { pos_name: true } },
                },
                orderBy: { first_name: "asc" },
            });
        }

        // For each member, get clock status, hours today, current activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const teamStatus = await Promise.all(teamMembers.map(async (member: any) => {
            // Get latest clock log for today
            const clockLog = await prisma.d_tblclock_log.findFirst({
                where: {
                    user_id: member.user_id,
                    shift_date: { gte: today, lt: tomorrow },
                },
                orderBy: { clock_in_time: "desc" },
            });

            // Get all time logs for today
            const timeLogs = await prisma.d_tbltime_log.findMany({
                where: {
                    user_id: member.user_id,
                    log_date: { gte: today, lt: tomorrow },
                },
                include: { D_tblactivity: true },
            });

            // Calculate total hours today
            const hours_today = timeLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);

            // Find current activity (active time log with null end_time)
            const currentActivityLog = await prisma.d_tbltime_log.findFirst({
                where: {
                    user_id: member.user_id,
                    log_date: { gte: today, lt: tomorrow },
                    end_time: null,
                },
                include: { D_tblactivity: true },
                orderBy: { tlog_id: "desc" },
            });

            let status = "Offline";
            let clock_in_time = null;
            let clock_out_time = null;
            if (clockLog) {
                if (clockLog.clock_out_time) {
                    status = "Clocked Out";
                    clock_in_time = clockLog.clock_in_time?.toISOString() || null;
                    clock_out_time = clockLog.clock_out_time?.toISOString() || null;
                } else {
                    status = "Working";
                    clock_in_time = clockLog.clock_in_time?.toISOString() || null;
                }
            }

            return {
                user_id: member.user_id,
                name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim(),
                email: member.email,
                department: member.D_tbldepartment?.dept_name ?? "",
                team: member.D_tblteam?.team_name ?? "",
                position: member.D_tblposition?.pos_name ?? "",
                status,
                hours_today,
                current_activity: currentActivityLog?.D_tblactivity?.activity_name || "—",
                is_billable: currentActivityLog?.D_tblactivity?.is_billable ?? false,
                clock_in_time,
                clock_out_time,
            };
        }));

        return NextResponse.json({ teamStatus });
    } catch (error) {
        console.error("TEAM_STATUS_ERROR:", error);
        return NextResponse.json({ message: "Failed to load team status" }, { status: 500 });
    }
}
