// app/api/admin/users/update/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
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
      account_status,
      hire_date,
      resignation_date,
    } = body;

    if (!user_id) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Get existing user
    const existingUser = await prisma.d_tbluser.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Check email uniqueness if changed
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.d_tbluser.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json({ message: "Email already exists" }, { status: 400 });
      }
    }

    // Build update data
    const updateData: any = {};

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (role_id !== undefined) updateData.role_id = parseInt(role_id);
    if (pos_id !== undefined) updateData.pos_id = parseInt(pos_id);
    if (dept_id !== undefined) updateData.dept_id = parseInt(dept_id);
    if (team_id !== undefined) updateData.team_id = team_id ? parseInt(team_id) : null;
    if (supervisor_id !== undefined) updateData.supervisor_id = supervisor_id || null;
    if (manager_id !== undefined) updateData.manager_id = manager_id || null;
    if (account_status !== undefined) updateData.account_status = account_status;
    if (hire_date !== undefined) updateData.hire_date = new Date(hire_date);
    if (resignation_date !== undefined) updateData.resignation_date = resignation_date ? new Date(resignation_date) : null;

    // Update user
    const updatedUser = await prisma.d_tbluser.update({
      where: { user_id },
      data: updateData,
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "UPDATE_USER",
        table_affected: "D_tbluser",
        old_value: JSON.stringify(existingUser),
        new_value: JSON.stringify(updatedUser),
      },
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}
