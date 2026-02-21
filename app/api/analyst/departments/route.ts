// app/api/analyst/departments/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;

export async function GET() {
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

    // Fetch all departments with names
    const departments = await prisma.d_tbldepartment.findMany({
      select: {
        dept_name: true,
      },
      orderBy: { dept_name: "asc" },
    });

    // Extract department names, filter out nulls
    const departmentNames = departments
      .map((d) => d.dept_name)
      .filter((name): name is string => name !== null);

    return NextResponse.json({
      success: true,
      data: departmentNames,
    });
  } catch (error) {
    console.error("Departments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}
