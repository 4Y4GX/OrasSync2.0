import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 4 && user.role_id !== 3 && user.role_id !== 2)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { fts_id } = await request.json();

    if (!fts_id) {
      return NextResponse.json({ message: "Activity ID required" }, { status: 400 });
    }

    await prisma.d_tblfuture_schedule.delete({
      where: {
        fts_id: fts_id 
      }
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete activity", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}