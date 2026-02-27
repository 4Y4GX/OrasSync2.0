import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

// GET: Fetch one random security question for the authenticated user
export async function GET() {
    try {
        const user = await getUserFromCookie();

        if (!user || user.role_id !== 4) {
            console.log(`[SQ-DEBUG] Unauthorized: user=${user?.user_id}, role=${user?.role_id}`);
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const userId = user.user_id;

        // Fetch ONE random question from the user's answers
        const userAnswers = await prisma.d_tbluser_security_answers.findMany({
            where: { user_id: userId },
            include: { D_tblsecurity_questions: true },
        });

        if (userAnswers.length === 0) {
            console.log(`[SQ-DEBUG] No questions found in DB for user=${userId}`);
            return NextResponse.json({ message: "No security questions found" }, { status: 404 });
        }

        // Pick a random question
        const randomIndex = Math.floor(Math.random() * userAnswers.length);
        const selected = userAnswers[randomIndex];

        return NextResponse.json(
            {
                question_id: selected.question_id,
                question_text: selected.D_tblsecurity_questions?.question_text || "SECURITY CHECK",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Fetch supervisor security question error:", error);
        return NextResponse.json({ message: "Failed to fetch security question" }, { status: 500 });
    }
}

// POST: Verify answer
export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();

        if (!user || user.role_id !== 4) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { questionId, answer } = await request.json().catch(() => ({}));

        if (!questionId || typeof answer !== "string") {
            return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
        }

        const userId = user.user_id;

        const userAuth = await prisma.d_tbluser_authentication.findUnique({
            where: { user_id: userId },
            select: { question_attempts: true, is_disabled: true },
        });

        if (!userAuth) {
            return NextResponse.json({ message: "Authentication record not found" }, { status: 400 });
        }

        const currentAttempts = userAuth.question_attempts ?? 0;

        // Reject if already disabled or exhausted
        if (currentAttempts >= 3 || userAuth.is_disabled) {
            return NextResponse.json({ message: "Account disabled due to too many failed attempts" }, { status: 403 });
        }

        const correctAnswer = await prisma.d_tbluser_security_answers.findFirst({
            where: { user_id: userId, question_id: Number(questionId) },
            select: { answer_hash: true },
        });

        const isMatch = !!correctAnswer && correctAnswer.answer_hash === answer;

        if (!isMatch) {
            const nextAttempts = currentAttempts + 1;

            // Update attempts
            await prisma.d_tbluser_authentication.update({
                where: { user_id: userId },
                data: {
                    question_attempts: nextAttempts,
                    is_disabled: nextAttempts >= 3 ? true : userAuth.is_disabled,
                },
            });

            // If they reached 3 attempts, create an incident
            if (nextAttempts >= 3) {
                try {
                    // Log out the user by clearing the auth token later in the client (or we could clear the cookie here, but returning 403 handles it)
                    const dedupeKey = `SUPERVISOR_SECURITY_LOCK_${userId}`;
                    const existing = await prisma.d_tblaccount_recovery_incident.findFirst({
                        where: { dedupe_key: dedupeKey, status: "OPEN" },
                    });

                    if (!existing) {
                        await prisma.d_tblaccount_recovery_incident.create({
                            data: {
                                user_id: userId,
                                incident_type: "ACCOUNT_LOCKED_LOGIN_FAILURE",
                                status: "OPEN",
                                dedupe_key: dedupeKey,
                                created_at: new Date(),
                            },
                        });
                    }
                } catch (e) {
                    console.error("Failed to create lock incident", e);
                }

                // Return a specific payload so the frontend knows to log them out
                return NextResponse.json({ message: "Account locked", lockedOut: true }, { status: 403 });
            }

            return NextResponse.json({ message: "Incorrect answer" }, { status: 401 });
        }

        // Success: reset attempt counter
        await prisma.d_tbluser_authentication.update({
            where: { user_id: userId },
            data: { question_attempts: 0 },
        });

        return NextResponse.json({ message: "Verified successfully", verified: true }, { status: 200 });
    } catch (error) {
        console.error("Verify supervisor security question error:", error);
        return NextResponse.json({ message: "Failed to verify answer" }, { status: 500 });
    }
}
