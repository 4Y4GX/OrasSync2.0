import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // 1. Create Roles
    await prisma.d_tblrole.createMany({
      data: [
        { role_id: 1, role_name: "Admin" },
        { role_id: 2, role_name: "Employee" },
      ],
      skipDuplicates: true, 
    });

    // 2. Create Security Questions (UPDATED LIST)
    await prisma.d_tblsecurity_questions.createMany({
      data: [
        { question_text: "What was your first pet's name?" },
        { question_text: "What city were you born in?" },
        { question_text: "What is your mother's maiden name?" },
        { question_text: "What is your favorite book?" },
        { question_text: "What was the model of your first car?" },
        { question_text: "What is the name of your favorite teacher?" },
        { question_text: "What is your favorite movie?" },
        { question_text: "What was your childhood nickname?" },
        { question_text: "What street did you grow up on?" },
      ],
      skipDuplicates: true,
    });

    // 3. Create Users (Make sure to use GMAIL addresses)
    // ADMIN (Role 3 per your previous fix, or 1 if you swapped them back. I will use 3 based on your screenshot)
    // NOTE: Check your database for the correct role_id for "Admin" before running this!
    /*
    const adminUser = await prisma.d_tbluser.create({ ... });
    */
   
    // If you already have users, you don't need to recreate them. 
    // Just running the questions part above is enough.

    return NextResponse.json({ message: "Security questions seeded!" });

  } catch (error: any) {
    return NextResponse.json({ message: "Error seeding", error: error.message }, { status: 500 });
  }
}