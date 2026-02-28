import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { hashSecurityAnswer } from "@/lib/securityAnswer";

// GET: Fetch questions for the frontend dropdowns
export async function GET() {
  try {
    const questions = await prisma.d_tblsecurity_questions.findMany();
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching questions" }, { status: 500 });
  }
}

// POST: Save new password and answers
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, newPassword, securityAnswers } = body;

    // Validate Input
    if (!user_id || !newPassword || !securityAnswers || securityAnswers.length !== 3) {
      return NextResponse.json({ message: "Missing required data" }, { status: 400 });
    }

    // 1. Update Password & Disable First Login
    const hashedPassword = await hashPassword(newPassword);
    await prisma.d_tbluser_authentication.update({
      where: { user_id: user_id },
      data: {
        password_hash: hashedPassword,
        is_first_login: false,
      },
    });

    // 2. Save Security Answers (Clean old ones first)
    await prisma.d_tbluser_security_answers.deleteMany({
      where: { user_id: user_id }
    });

    for (const item of securityAnswers) {
      const hashedAnswer = await hashSecurityAnswer(item.answer);
      await prisma.d_tbluser_security_answers.create({
        data: {
          user_id: user_id,
          question_id: parseInt(item.question_id),
          answer_hash: hashedAnswer,
        }
      });
    }

    return NextResponse.json({ message: "Setup complete" }, { status: 200 });

  } catch (error) {
    console.error("First Login Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}