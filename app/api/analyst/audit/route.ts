// app/api/analyst/audit/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is analyst
    if (user.role_id !== 5) {
      return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const action_type = searchParams.get("action_type");
    const table_affected = searchParams.get("table_affected");
    const changed_by = searchParams.get("changed_by");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (action_type && action_type !== "ALL") {
      whereClause.action_type = action_type;
    }

    if (table_affected && table_affected !== "ALL") {
      whereClause.table_affected = table_affected;
    }

    if (changed_by) {
      whereClause.changed_by = changed_by;
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.created_at.lte = end;
      }
    }

    // Get total count
    const totalCount = await prisma.d_tblaudit_log.count({ where: whereClause });

    // Get paginated logs
    const auditLogs = await prisma.d_tblaudit_log.findMany({
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
      },
      orderBy: {
        created_at: "desc",
      },
      skip,
      take: limit,
    });

    // Get unique action types and tables for filters
    const actionTypes = await prisma.d_tblaudit_log.findMany({
      select: { action_type: true },
      distinct: ["action_type"],
      where: { action_type: { not: null } },
    });

    const tablesAffected = await prisma.d_tblaudit_log.findMany({
      select: { table_affected: true },
      distinct: ["table_affected"],
      where: { table_affected: { not: null } },
    });

    return NextResponse.json({
      logs: auditLogs.map(log => ({
        audit_id: log.audit_id,
        changed_by: log.changed_by,
        user_name: log.D_tbluser ? `${log.D_tbluser.first_name} ${log.D_tbluser.last_name}` : "Unknown",
        user_email: log.D_tbluser?.email || "N/A",
        action_type: log.action_type,
        table_affected: log.table_affected,
        old_value: log.old_value,
        new_value: log.new_value,
        created_at: log.created_at,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        actionTypes: actionTypes.map(a => a.action_type).filter(Boolean),
        tablesAffected: tablesAffected.map(t => t.table_affected).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 });
  }
}
