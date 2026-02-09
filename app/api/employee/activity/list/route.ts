// app/api/employee/activity/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get all active activities
    const activities = await prisma.d_tblactivity.findMany({
      where: {
        // is_active: true,
      },
      select: {
        activity_id: true,
        activity_code: true,
        activity_name: true,
        is_billable: true,
      },
      orderBy: {
        activity_name: "asc",
      },
    });

    return NextResponse.json({
      activities,
    });
  } catch (error) {
    console.error("Get activities list error:", error);
    return NextResponse.json(
      { message: "Failed to get activities list" },
      { status: 500 }
    );
  }
}
