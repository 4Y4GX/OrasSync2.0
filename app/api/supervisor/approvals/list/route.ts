import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user || (user.role_id !== 4 && user.role_id !== 3 && user.role_id !== 2)) {
            return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
        }

        // Get team members for supervisor
        let teamMembers;
        if (user.role_id === 4) {
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
                where: {
                    role_id: 1,
                    account_status: "ACTIVE",
                },
                select: { user_id: true, first_name: true, last_name: true },
            });
        }
        const teamIds = teamMembers.map((m: any) => m.user_id);
        const userIdToName = Object.fromEntries(teamMembers.map((m: any) => [m.user_id, `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()]));

        // Get all pending time logs for team
        const pendingLogs = await prisma.d_tbltime_log.findMany({
            where: {
                user_id: { in: teamIds },
                approval_status: "PENDING",
            },
            include: { D_tblactivity: true },
            orderBy: [{ user_id: "asc" }, { log_date: "desc" }, { start_time: "asc" }],
        });

        // Group by user and date
        const grouped: Record<string, any> = {};
        for (const log of pendingLogs) {
            const dateKey = `${log.user_id}|${log.log_date?.toISOString().slice(0, 10)}`;
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    user_id: log.user_id,
                    employee: log.user_id != null ? (userIdToName[log.user_id] || log.user_id) : "Unknown",
                    date: log.log_date?.toISOString().slice(0, 10) ?? '',
                    hours: 0,
                    activities: 0,
                    status: "pending",
                    log_ids: [],
                    details: [],
                };
            }
            grouped[dateKey].hours += log.total_hours?.toNumber() || 0;
            grouped[dateKey].activities++;
            grouped[dateKey].log_ids.push(log.tlog_id);
            // Format date as MM/DD/YYYY
            function formatDate(dt: Date | string | null | undefined): string {
                if (!dt) return "";
                const d = new Date(dt);
                return `${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
            }
            // Format time as HH:mm
            function formatTime(dt: Date | string | null | undefined): string {
                if (!dt) return "";
                const d = new Date(dt);
                return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
            }
            // Format decimal hours as HH:mm
            function formatHoursToHHMM(hours: number | string | null | undefined): string {
                if (!hours) return "00:00";
                const h = typeof hours === 'number' ? hours : parseFloat(hours);
                const totalMinutes = Math.round(h * 60);
                const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
                const mm = (totalMinutes % 60).toString().padStart(2, '0');
                return `${hh}:${mm}`;
            }
            grouped[dateKey].details.push({
                activity_name: log.D_tblactivity?.activity_name ?? "",
                log_date: formatDate(log.log_date),
                start_time: formatTime(log.start_time),
                end_time: formatTime(log.end_time),
                hours: formatHoursToHHMM(
                    log.total_hours && typeof log.total_hours === 'object' && typeof log.total_hours.toNumber === 'function'
                        ? log.total_hours.toNumber()
                        : typeof log.total_hours === 'number'
                            ? log.total_hours
                            : typeof log.total_hours === 'string'
                                ? parseFloat(log.total_hours)
                                : 0
                ),
                is_billable: log.D_tblactivity?.is_billable ?? false,
            });
        }

        const approvals = Object.values(grouped).sort((a: any, b: any) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return a.employee.localeCompare(b.employee);
        });

        return NextResponse.json(approvals);
    } catch (error: any) {
        console.error("APPROVAL_LIST_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to load approvals" },
            { status: 500 }
        );
    }
}
