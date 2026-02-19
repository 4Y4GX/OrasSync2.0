import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    
    // Set strictly to 3 based on your database schema for Admin
    const ADMIN_ROLE_ID = 3; 

    // Updated security check
    if (!user || user.role_id !== ADMIN_ROLE_ID) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const users = await prisma.d_tbluser.findMany({
      include: {
        D_tblrole: true,
        D_tblposition: true,
        D_tbldepartment: true,
        D_tblteam: true,
      },
      orderBy: { user_id: "asc" },
    });

    // Convert to CSV
    const headers = [
      "User ID",
      "First Name",
      "Last Name",
      "Email",
      "Role",
      "Position",
      "Department",
      "Team",
      "Account Status",
      "Hire Date",
      "Resignation Date",
    ];

    const rows = users.map(u => [
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.D_tblrole?.role_name || "",
      u.D_tblposition?.pos_name || "",
      u.D_tbldepartment?.dept_name || "",
      u.D_tblteam?.team_name || "",
      u.account_status,
      u.hire_date?.toISOString().split('T')[0] || "",
      u.resignation_date?.toISOString().split('T')[0] || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export users error:", error);
    return NextResponse.json({ message: "Failed to export users" }, { status: 500 });
  }
}