// app/api/analyst/system-events/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;

type EventType = "DATA_SYNCHRONIZATION" | "USAGE_ALERT" | "REPORT_GENERATED";
type EventStatus = "green" | "yellow" | "blue";

interface SystemEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: string;
  status: EventStatus;
}

// Map action types to event types and statuses
function mapActionToEvent(
  actionType: string | null,
  tableAffected: string | null
): { type: EventType; status: EventStatus } {
  const action = (actionType || "").toLowerCase();
  const table = (tableAffected || "").toLowerCase();

  // DATA_SYNCHRONIZATION - clock/time log activities
  if (table.includes("clock") || table.includes("time") || action.includes("sync")) {
    return { type: "DATA_SYNCHRONIZATION", status: "green" };
  }

  // USAGE_ALERT - authentication/security events
  if (
    table.includes("auth") ||
    table.includes("security") ||
    action.includes("login") ||
    action.includes("failed") ||
    action.includes("alert")
  ) {
    return { type: "USAGE_ALERT", status: "yellow" };
  }

  // REPORT_GENERATED - everything else (approvals, exports, etc.)
  return { type: "REPORT_GENERATED", status: "blue" };
}

function formatEventMessage(
  actionType: string | null,
  tableAffected: string | null,
  newValue: string | null
): string {
  const action = actionType || "Unknown action";
  const table = (tableAffected || "").replace(/^D_tbl/i, "").replace(/_/g, " ");

  if (action.toLowerCase().includes("create")) {
    return `New ${table} record created`;
  }
  if (action.toLowerCase().includes("update")) {
    return `${table} data synchronized`;
  }
  if (action.toLowerCase().includes("delete")) {
    return `${table} record removed`;
  }
  if (action.toLowerCase().includes("login")) {
    return "User authentication event logged";
  }
  if (action.toLowerCase().includes("approve")) {
    return "Timesheet approval processed";
  }
  if (action.toLowerCase().includes("export")) {
    return "Report generated and exported";
  }

  return `${action} on ${table}`;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only analysts and admins can access this endpoint
    if (user.role_id !== ROLE_ANALYST && user.role_id !== ROLE_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Fetch recent audit logs
    const auditLogs = await prisma.d_tblaudit_log.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        audit_id: true,
        action_type: true,
        table_affected: true,
        new_value: true,
        created_at: true,
      },
    });

    // Transform to system events format
    const events: SystemEvent[] = auditLogs.map((log) => {
      const { type, status } = mapActionToEvent(log.action_type, log.table_affected);
      return {
        id: log.audit_id.toString(),
        type,
        message: formatEventMessage(log.action_type, log.table_affected, log.new_value),
        timestamp: log.created_at?.toISOString() || new Date().toISOString(),
        status,
      };
    });

    // If no audit logs exist, return some default system events
    if (events.length === 0) {
      const now = new Date();
      const defaultEvents: SystemEvent[] = [
        {
          id: "sys-1",
          type: "DATA_SYNCHRONIZATION",
          message: "System initialized - awaiting activity logs",
          timestamp: now.toISOString(),
          status: "green",
        },
        {
          id: "sys-2",
          type: "REPORT_GENERATED",
          message: "Analytics dashboard ready",
          timestamp: new Date(now.getTime() - 60000).toISOString(),
          status: "blue",
        },
      ];
      return NextResponse.json({
        success: true,
        data: defaultEvents,
      });
    }

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("System events error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system events" },
      { status: 500 }
    );
  }
}
