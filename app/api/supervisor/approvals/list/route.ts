import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Fetch all pending logs where this user is the supervisor
        const pendingLogs = await prisma.d_tbltime_log.findMany({
            where: {
                supervisor_id_at_log: user.user_id,
                approval_status: 'PENDING'
            },
            include: {
                D_tbluser_D_tbltime_log_user_idToD_tbluser: {
                    select: { first_name: true, last_name: true }
                },
                D_tblactivity: {
                    select: { activity_name: true }
                }
            },
            orderBy: {
                log_date: 'desc'
            }
        });

        // Group by User and Date for the card view
        const groupedData: Record<string, any> = {};

        pendingLogs.forEach(log => {
            if (!log.log_date || !log.user_id) return;

            const dateStr = new Date(log.log_date).toISOString().split('T')[0];
            const key = `${log.user_id}_${dateStr}`;

            if (!groupedData[key]) {
                groupedData[key] = {
                    user_id: log.user_id,
                    employee: `${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name} ${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name}`,
                    date: dateStr,
                    hours: 0,
                    activities: 0,
                    status: 'pending',
                    log_ids: []
                };
            }

            groupedData[key].hours += Number(log.total_hours) || 0;
            groupedData[key].activities += 1;
            groupedData[key].log_ids.push(log.tlog_id);
        });

        return NextResponse.json(Object.values(groupedData));

    } catch (error: any) {
        console.error("APPROVAL_LIST_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to load approvals" },
            { status: 500 }
        );
    }
}
