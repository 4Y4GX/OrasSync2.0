import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromCookie();
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json({ employees: [] });
  }

  try {
    const employees = await prisma.d_tbluser.findMany({
      where: {
        OR: [
          { first_name: { contains: query } }, // removed mode: 'insensitive' for MySQL compatibility
          { last_name: { contains: query } },
          { user_id: { contains: query } },
        ],
        // Optional: Filter by manager's department if needed
        // manager_id: user.user_id 
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        dept_id: true,
        team_id: true,
        D_tbldepartment: { select: { dept_name: true } }
      },
      take: 5,
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Search Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}