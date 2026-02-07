import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

type SentimentValue = "GREAT" | "OKAY" | "NOT_GOOD";

function normalizeSentiment(input: unknown): SentimentValue | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toUpperCase();
  if (v === "GREAT") return "GREAT";
  if (v === "OKAY") return "OKAY";
  if (v === "NOT_GOOD" || v === "NOT GOOD") return "NOT_GOOD";
  return null;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({} as any));
    const sentiment = normalizeSentiment(body.sentiment);
    const commentRaw = typeof body.comment === "string" ? body.comment : "";
    const comment = commentRaw.trim();

    if (!sentiment) {
      return NextResponse.json({ message: "Sentiment is required." }, { status: 400 });
    }

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    // Find today's sentiment (if exists) to make it once-per-day
    const existing = await prisma.d_tblsentiment_log.findFirst({
      where: {
        user_id: user.user_id,
        created_at: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { created_at: "desc" },
      select: { sentiment_id: true },
    });

    // Try attach to today's clock log if exists (optional)
    const todayDate = new Date(now);
    todayDate.setHours(0, 0, 0, 0);

    const todayClock = await prisma.d_tblclock_log.findFirst({
      where: {
        user_id: user.user_id,
        shift_date: todayDate, // @db.Date
      },
      orderBy: { clock_id: "desc" },
      select: { clock_id: true },
    });

    if (existing?.sentiment_id) {
      await prisma.d_tblsentiment_log.update({
        where: { sentiment_id: existing.sentiment_id },
        data: {
          sentiment_status: sentiment,
          reason_comment: comment.length ? comment : null,
          clock_id: todayClock?.clock_id ?? null,
        },
      });
    } else {
      await prisma.d_tblsentiment_log.create({
        data: {
          user_id: user.user_id,
          clock_id: todayClock?.clock_id ?? null,
          sentiment_status: sentiment,
          reason_comment: comment.length ? comment : null,
          created_at: new Date(),
        },
      });
    }

    // Optionally mark is_sentiment_done on today's clock record
    if (todayClock?.clock_id) {
      await prisma.d_tblclock_log.update({
        where: { clock_id: todayClock.clock_id },
        data: { is_sentiment_done: true },
      });
    }

    return NextResponse.json({ message: "Sentiment recorded successfully." });
  } catch (error) {
    console.error("Sentiment API Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
