// app/api/manager/timesheets/pending/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    let whereClause: any = {};

    if (user.role_id === 2) {
      // Supervisor: only see their team's timesheets
      whereClause = {
        supervisor_id_at_log: user.user_id,
        approved_by_supervisor_id: status === "SUPERVISOR_APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING",
      };
    } else if (user.role_id === 3) {
      // Manager: see supervisor-approved timesheets
      whereClause = {
        approved_by_supervisor_id: "APPROVED",
        approved_by_manager_id: status === "MANAGER_APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING",
      };
    }

    const timesheets = await prisma.d_tbltime_log.findMany({
      where: whereClause,
      include: {
        D_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        D_tblactivity: {
          select: {
            activity_name: true,
            activity_code: true,
            is_billable: true,
          },
        },
      },
      orderBy: { log_date: "desc" },
      take: 100,
    });

    return NextResponse.json({ timesheets });
  } catch (error) {
    console.error("Get pending timesheets error:", error);
    return NextResponse.json({ message: "Failed to fetch timesheets" }, { status: 500 });
  }
}
