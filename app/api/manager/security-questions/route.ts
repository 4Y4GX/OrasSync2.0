import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    // Find the first security answer this user has registered
    const userAnswer = await prisma.d_tbluser_security_answers.findFirst({
      where: { user_id: user.user_id }
    });

    // FIXED: Added check to ensure question_id is not null to satisfy TypeScript
    if (!userAnswer || !userAnswer.question_id) {
      return NextResponse.json({ message: "No security questions setup." }, { status: 404 });
    }

    // Fetch the actual question text
    const questionDef = await prisma.d_tblsecurity_questions.findUnique({
      where: { question_id: userAnswer.question_id }
    });

    return NextResponse.json({ 
      questionId: userAnswer.question_id, 
      questionText: questionDef?.question_text || "Verify your identity"
    });

  } catch (error) {
    console.error("Fetch Question Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}