import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const logs = await prisma.d_tblaudit_log.findMany({
      orderBy: { created_at: 'desc' },
      take: 100, // Limit to last 100 actions for performance
      select: {
        audit_id: true,
        changed_by: true,
        action_type: true,
        created_at: true,
        table_affected: true
      }
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ message: "Failed to fetch logs" }, { status: 500 });
  }
}