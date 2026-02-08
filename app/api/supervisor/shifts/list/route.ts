// app/api/supervisor/shifts/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    // Get all shift templates
    const shifts = await prisma.d_tblshift_template.findMany({
      orderBy: { start_time: "asc" },
    });

    return NextResponse.json({ shifts });
  } catch (error) {
    console.error("List shifts error:", error);
    return NextResponse.json({ message: "Failed to fetch shifts" }, { status: 500 });
  }
}
