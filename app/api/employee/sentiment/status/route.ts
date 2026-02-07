import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

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

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const existing = await prisma.d_tblsentiment_log.findFirst({
    where: {
      user_id: user.user_id,
      created_at: { gte: dayStart, lte: dayEnd },
    },
    select: { sentiment_id: true },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ doneToday: !!existing });
}
