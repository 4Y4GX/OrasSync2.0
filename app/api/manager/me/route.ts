import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbUser = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      include: { D_tblposition: true }
    });

    if (!dbUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Safely handle potentially null names to prevent TypeScript errors
    const fName = dbUser.first_name || "";
    const lName = dbUser.last_name || "";
    const fullName = `${fName} ${lName}`.trim() || "Unknown User";
    
    // Safely grab the first letters for the avatar
    const initial1 = fName.charAt(0) || "";
    const initial2 = lName.charAt(0) || "";
    const initials = (initial1 + initial2).toUpperCase() || "M"; // Fallback to 'M' if no name exists

    return NextResponse.json({
      name: fullName,
      initials: initials,
      position: dbUser.D_tblposition?.pos_name || 'Manager'
    });

  } catch (error) {
    console.error("Fetch User Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}