import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { log_ids, action, rejection_reason } = await req.json();

        if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
            return NextResponse.json({ message: "No logs selected" }, { status: 400 });
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        // Validate rejection reason is provided for rejections
        if (action === 'REJECT' && (!rejection_reason || !rejection_reason.trim())) {
            return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
        }

        const status = action === 'APPROVE' ? 'SUPERVISOR_APPROVED' : 'REJECTED';
        const approvedBy = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

        await prisma.d_tbltime_log.updateMany({
            where: {
                tlog_id: { in: log_ids },
                supervisor_id_at_log: user.user_id // Ensure ownership
            },
            data: {
                approval_status: status,
                supervisor_approved_at: new Date(),
                approved_by_supervisor_id: approvedBy,
                ...(action === 'REJECT' && rejection_reason ? { rejection_reason: rejection_reason.trim() } : {})
            }
        });

        return NextResponse.json({ message: "Success" });

    } catch (error: any) {
        console.error("APPROVAL_ACTION_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to process approval" },
            { status: 500 }
        );
    }
}
