// app/api/admin/users/update/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const {
      user_id, first_name, last_name, email, role_id, pos_id, dept_id, team_id,
      supervisor_id, manager_id, account_status, hire_date, original_hire_date,
      resignation_date, original_resignation_date,
    } = body;

    if (!user_id) return NextResponse.json({ message: "User ID required" }, { status: 400 });

    // 1. Check existence first (Read operation)
    const existingUser = await prisma.d_tbluser.findUnique({ where: { user_id } });
    if (!existingUser) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // 2. Prepare Data
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (role_id !== undefined) updateData.role_id = parseInt(role_id);
    if (pos_id !== undefined) updateData.pos_id = parseInt(pos_id);
    if (dept_id !== undefined) updateData.dept_id = parseInt(dept_id);
    // Explicitly handle NULL for relations
    updateData.team_id = team_id ? parseInt(team_id) : null;
    updateData.supervisor_id = supervisor_id || null;
    updateData.manager_id = manager_id || null;
    if (account_status !== undefined) updateData.account_status = account_status;

    // Date Handling
    if (hire_date !== undefined) updateData.hire_date = hire_date ? new Date(hire_date) : null;
    if (resignation_date !== undefined) updateData.resignation_date = resignation_date ? new Date(resignation_date) : null;
    if (original_hire_date !== undefined) updateData.original_hire_date = original_hire_date ? new Date(original_hire_date) : null;
    if (original_resignation_date !== undefined) updateData.original_resignation_date = original_resignation_date ? new Date(original_resignation_date) : null;

    // 3. EXECUTE TRANSACTION with Increased Timeout
    const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.d_tbluser.update({
            where: { user_id },
            data: updateData,
        });

        // Only touch auth table if unlocking
        if (account_status === 'ACTIVE') {
            try {
                await tx.d_tbluser_authentication.update({
                    where: { user_id },
                    data: { is_disabled: false, failed_attempts: 0 }
                });
            } catch (e) {
                // Ignore auth update error if record missing
            }
        }
        return u;
    }, {
        maxWait: 5000, // Wait max 5s for a connection
        timeout: 10000 // Allow transaction to run for 10s
    });

    // 4. Create Audit Log (Outside transaction to prevent locking)
    try {
        await prisma.d_tblaudit_log.create({
            data: {
                changed_by: user.user_id,
                action_type: "UPDATE_USER",
                table_affected: "D_tbluser",
                old_value: JSON.stringify(existingUser).substring(0, 250), // Truncate to safety limit
                new_value: JSON.stringify(updatedUser).substring(0, 250), // Truncate to safety limit
            },
        });
    } catch (logError) {
        console.error("Audit Log failed (Non-critical):", logError);
    }

    return NextResponse.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}