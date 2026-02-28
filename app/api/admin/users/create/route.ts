import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    
    const ADMIN_ROLE_ID = 3; 

    if (!user || user.role_id !== ADMIN_ROLE_ID) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const {
      user_id,
      first_name,
      last_name,
      email,
      role_id,
      pos_id,
      dept_id,
      team_id,
      supervisor_id,
      manager_id,
      hire_date,
      password,
    } = body;

    // Validation
    if (!user_id || !first_name || !last_name || !email || !role_id || !pos_id || !dept_id || !hire_date || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user_id already exists
    const existing = await prisma.d_tbluser.findUnique({
      where: { user_id },
    });

    if (existing) {
      return NextResponse.json({ message: "User ID already exists" }, { status: 400 });
    }

    // Check if email already exists
    const existingEmail = await prisma.d_tbluser.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    // Create user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.d_tbluser.create({
        data: {
          user_id,
          first_name,
          last_name,
          email,
          role_id: parseInt(role_id),
          pos_id: parseInt(pos_id),
          dept_id: parseInt(dept_id),
          team_id: team_id ? parseInt(team_id) : null,
          supervisor_id: supervisor_id || null,
          manager_id: manager_id || null,
          hire_date: new Date(hire_date),
          account_status: "ACTIVE",
        },
      });

      // Storing RAW password text to fix login issues
      await tx.d_tbluser_authentication.create({
        data: {
          user_id,
          password_hash: password, 
          is_first_login: true,
          failed_attempts: 0,
          is_disabled: false,
          question_attempts: 0,
        },
      });

      await tx.d_tbluser_stats.create({
        data: {
          user_id,
          streak_count: 0,
          total_absences: 0,
        },
      });

      return newUser;
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "CREATE_USER",
        table_affected: "D_tbluser",
        old_value: null,
        new_value: `Created user: ${user_id} (${email})`,
      },
    });

    return NextResponse.json({
      message: "User created successfully",
      user: result,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
  }
}