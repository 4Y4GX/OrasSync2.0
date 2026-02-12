// app/api/import/users/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    // CHANGED: Now checking for role_id 3 (Admin)
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { users } = body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ message: "Users array is required" }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const userData of users) {
      try {
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
        } = userData;

        // Validation
        if (!user_id || !first_name || !last_name || !email || !role_id || !pos_id || !dept_id || !hire_date || !password) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: Missing required fields`);
          continue;
        }

        // Check if user exists
        const existing = await prisma.d_tbluser.findUnique({
          where: { user_id },
        });

        if (existing) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: User ${user_id} already exists`);
          continue;
        }

        // Create user in transaction
        await prisma.$transaction(async (tx) => {
          await tx.d_tbluser.create({
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

          await tx.d_tbluser_authentication.create({
            data: {
              user_id,
              password_hash: sha256(password),
              is_first_login: true,
              failed_attempts: 0,
              is_disabled: false,
              questions_attempt: 0,
            },
          });

          await tx.d_tbluser_stats.create({
            data: {
              user_id,
              streak_count: 0,
              total_absences: 0,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`User ${userData.user_id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "BULK_IMPORT_USERS",
        table_affected: "D_tbluser",
        old_value: null,
        new_value: `Imported ${results.success} users, ${results.failed} failed`,
      },
    });

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("Import users error:", error);
    return NextResponse.json({ message: "Failed to import users" }, { status: 500 });
  }
}