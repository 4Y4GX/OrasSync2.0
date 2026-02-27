// app/api/analyst/sentiment/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is analyst
    if (user.role_id !== 2) {
      return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const deptId = searchParams.get("dept_id");
    const period = searchParams.get("period") || "week";

    // Calculate date range
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate: Date;

    if (period === "week") {
      startDate = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    } else {
      startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    }

    // Get sentiment logs
    const sentimentLogs = await prisma.d_tblsentiment_log.findMany({
      where: {
        created_at: { gte: startDate, lte: today },
        ...(deptId && deptId !== "ALL" ? {
          D_tbluser: { dept_id: parseInt(deptId) },
        } : {}),
      },
      include: {
        D_tbluser: {
          include: {
            D_tbldepartment: true,
            D_tblteam: true,
          },
        },
      },
    });

    // Overall sentiment breakdown
    const sentimentCounts = {
      GREAT: sentimentLogs.filter(log => log.sentiment_status === "GREAT").length,
      OKAY: sentimentLogs.filter(log => log.sentiment_status === "OKAY").length,
      NOT_GOOD: sentimentLogs.filter(log => log.sentiment_status === "NOT_GOOD").length,
    };

    const totalSentiments = sentimentLogs.length;
    const sentimentPercentages = {
      GREAT: totalSentiments > 0 ? Math.round((sentimentCounts.GREAT / totalSentiments) * 100) : 0,
      OKAY: totalSentiments > 0 ? Math.round((sentimentCounts.OKAY / totalSentiments) * 100) : 0,
      NOT_GOOD: totalSentiments > 0 ? Math.round((sentimentCounts.NOT_GOOD / totalSentiments) * 100) : 0,
    };

    // Burnout risk analysis (users with 2+ NOT_GOOD in the period)
    const userSentimentMap = new Map<string, any>();
    sentimentLogs.forEach(log => {
      if (!log.user_id) return;

      if (!userSentimentMap.has(log.user_id)) {
        userSentimentMap.set(log.user_id, {
          user_id: log.user_id,
          name: `${log.D_tbluser?.first_name || ""} ${log.D_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          team: log.D_tbluser?.D_tblteam?.team_name || "N/A",
          sentiments: [],
          great_count: 0,
          okay_count: 0,
          not_good_count: 0,
          latest_sentiment: null,
          latest_date: null,
        });
      }

      const userData = userSentimentMap.get(log.user_id);
      userData.sentiments.push({
        status: log.sentiment_status,
        date: log.created_at,
        reason: log.reason_comment,
      });

      if (log.sentiment_status === "GREAT") userData.great_count++;
      if (log.sentiment_status === "OKAY") userData.okay_count++;
      if (log.sentiment_status === "NOT_GOOD") userData.not_good_count++;

      // Track latest sentiment
      if (!userData.latest_date || (log.created_at && log.created_at > userData.latest_date)) {
        userData.latest_sentiment = log.sentiment_status;
        userData.latest_date = log.created_at;
      }
    });

    // Identify burnout risks (2+ NOT_GOOD sentiments)
    const burnoutRisks = Array.from(userSentimentMap.values())
      .filter(user => user.not_good_count >= 2)
      .map(user => ({
        user_id: user.user_id,
        name: user.name,
        department: user.department,
        team: user.team,
        not_good_count: user.not_good_count,
        latest_sentiment: user.latest_sentiment,
        risk_level: user.not_good_count >= 4 ? "HIGH" : user.not_good_count >= 2 ? "MEDIUM" : "LOW",
      }))
      .sort((a, b) => b.not_good_count - a.not_good_count);

    // Department sentiment breakdown
    const deptSentimentMap = new Map<string, any>();
    sentimentLogs.forEach(log => {
      const deptName = log.D_tbluser?.D_tbldepartment?.dept_name || "Unknown";

      if (!deptSentimentMap.has(deptName)) {
        deptSentimentMap.set(deptName, {
          department: deptName,
          great: 0,
          okay: 0,
          not_good: 0,
          total: 0,
        });
      }

      const deptData = deptSentimentMap.get(deptName);
      deptData.total++;

      if (log.sentiment_status === "GREAT") deptData.great++;
      if (log.sentiment_status === "OKAY") deptData.okay++;
      if (log.sentiment_status === "NOT_GOOD") deptData.not_good++;
    });

    const deptSentimentBreakdown = Array.from(deptSentimentMap.values()).map(dept => ({
      department: dept.department,
      great: dept.great,
      okay: dept.okay,
      not_good: dept.not_good,
      total: dept.total,
      morale_score: dept.total > 0 ? Math.round(((dept.great * 100 + dept.okay * 50) / dept.total)) : 0,
    }));

    // Daily sentiment trend (last 7 days)
    const dailyTrend: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayLogs = sentimentLogs.filter(log => {
        if (!log.created_at) return false;
        const logDate = new Date(log.created_at);
        return logDate >= date && logDate < nextDate;
      });

      const dayCounts = {
        date: date.toISOString().split('T')[0],
        great: dayLogs.filter(log => log.sentiment_status === "GREAT").length,
        okay: dayLogs.filter(log => log.sentiment_status === "OKAY").length,
        not_good: dayLogs.filter(log => log.sentiment_status === "NOT_GOOD").length,
      };

      dailyTrend.push(dayCounts);
    }

    return NextResponse.json({
      period,
      summary: {
        total: totalSentiments,
        counts: sentimentCounts,
        percentages: sentimentPercentages,
        avg_morale_score: totalSentiments > 0
          ? Math.round((sentimentCounts.GREAT * 100 + sentimentCounts.OKAY * 50) / totalSentiments)
          : 0,
      },
      burnoutRisks,
      departmentBreakdown: deptSentimentBreakdown,
      dailyTrend,
    });
  } catch (error) {
    console.error("Get sentiment analysis error:", error);
    return NextResponse.json({ message: "Failed to fetch sentiment data" }, { status: 500 });
  }
}
