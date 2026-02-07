import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recoveryCookieName, verifyRecoveryToken } from "@/lib/recoverySession";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((p) => p.startsWith(`${recoveryCookieName()}=`));

    const token = tokenMatch ? decodeURIComponent(tokenMatch.split("=").slice(1).join("=")) : null;
    const session = verifyRecoveryToken(token);

    if (!session?.userId) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 401 });
    }

    // Fetch ONE stable question (always ok to fetch even if stage is QUESTION_VERIFIED)
    const userAnswers = await prisma.d_tbluser_security_answers.findMany({
      where: { user_id: session.userId },
      include: { D_tblsecurity_questions: true },
      orderBy: { question_id: "asc" },
      take: 1,
    });

    if (userAnswers.length === 0) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 403 });
    }

    const selected = userAnswers[0];

    return NextResponse.json(
      {
        ok: true,
        stage: session.stage, // ✅ comes from cookie token only
        question_id: selected.question_id,
        question_text: selected.D_tblsecurity_questions?.question_text || "SECURITY CHECK",
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Recovery session check error:", e);
    return NextResponse.json({ message: "REQUEST FAILED" }, { status: 500 });
  }
}
