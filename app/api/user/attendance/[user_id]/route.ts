import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ user_id: string }> }) {
  try {
    const { user_id } = await params;
    let userStats = await prisma.d_tbluser_stats.findUnique({
      where: { user_id },
    });

    if (!userStats) {
      userStats = await prisma.d_tbluser_stats.create({
        data: {
          user_id,
          streak_count: 0,
          total_absences: 0,
        },
      });
    }

    return NextResponse.json({ userStats });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ message: "Failed to fetch or create user stats" }, { status: 500 });
  }
}
