"use client";

import { useState, useEffect } from "react";

/**
 * Format decimal hours to hours and minutes (e.g., 1.5 -> "1h 30m")
 */
function formatHoursMinutes(decimalHours: number | null | undefined): string {
  if (decimalHours == null || isNaN(decimalHours)) return "-";
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type AnalyticsData = {
  period: string;
  summary: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    daysWorked: number;
    avgHoursPerDay: number;
    streakCount: number;
  };
  activityBreakdown: { [key: string]: number };
  dailyHours: { [key: string]: number };
  approvalStats: {
    pending: number;
    supervisor_approved: number;
    manager_approved: number;
    rejected: number;
  };
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?period=${period}`);
      if (res.ok) {
        const analytics = await res.json();
        setData(analytics);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "3rem" }}>Loading analytics...</div>;
  }

  if (!data) {
    return <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No data available</div>;
  }

  const activityEntries = Object.entries(data.activityBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const dailyEntries = Object.entries(data.dailyHours)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);

  const maxDailyHours = Math.max(...dailyEntries.map(([, hours]) => hours), 1);

  const billablePercentage = data.summary.totalHours > 0 
    ? (data.summary.billableHours / data.summary.totalHours) * 100 
    : 0;

  return (
    <div className="analytics-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Personal Analytics</h2>
        <select
          className="select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ minWidth: "150px" }}
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="hud-row" style={{ marginBottom: "2rem" }}>
        <div className="hud-card">
          <div className="hud-label">Total Hours</div>
          <div className="hud-val" style={{ color: "var(--color-accent)" }}>
            {data.summary.totalHours}
          </div>
          <div className="hud-bg-icon">⏱</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Billable Hours</div>
          <div className="hud-val" style={{ color: "var(--color-go)" }}>
            {data.summary.billableHours}
          </div>
          <div className="hud-bg-icon">💰</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Days Worked</div>
          <div className="hud-val">{data.summary.daysWorked}</div>
          <div className="hud-bg-icon">📅</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Avg Hours/Day</div>
          <div className="hud-val">{data.summary.avgHoursPerDay}</div>
          <div className="hud-bg-icon">📊</div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Daily Hours Chart */}
        <div className="glass-card">
          <div className="section-title">Daily Hours Worked</div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", height: "200px" }}>
              {dailyEntries.map(([date, hours]) => {
                const height = (hours / maxDailyHours) * 100;
                const dateObj = new Date(date);
                const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                
                return (
                  <div
                    key={date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{formatHoursMinutes(hours)}</div>
                    <div
                      style={{
                        width: "100%",
                        height: `${height}%`,
                        background: "linear-gradient(180deg, var(--color-accent), var(--color-accent-dark))",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{dayLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Breakdown */}
        <div className="glass-card">
          <div className="section-title">Top Activities</div>
          <div style={{ padding: "1.5rem" }}>
            {activityEntries.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                No activities recorded
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {activityEntries.map(([activity, hours]) => {
                  const percentage = (hours / data.summary.totalHours) * 100;
                  return (
                    <div key={activity}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.9rem" }}>{activity}</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                          {formatHoursMinutes(hours)} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background: "var(--color-accent)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Billable vs Non-billable */}
        <div className="glass-card">
          <div className="section-title">Billable Breakdown</div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: `conic-gradient(
                    var(--color-go) 0% ${billablePercentage}%,
                    rgba(255,255,255,0.1) ${billablePercentage}% 100%
                  )`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: "var(--bg-panel)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                  }}
                >
                  {billablePercentage.toFixed(0)}%
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ width: "12px", height: "12px", background: "var(--color-go)", borderRadius: "2px" }} />
                    <span style={{ fontSize: "0.9rem" }}>Billable</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.summary.billableHours}h</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ width: "12px", height: "12px", background: "rgba(255,255,255,0.3)", borderRadius: "2px" }} />
                    <span style={{ fontSize: "0.9rem" }}>Non-billable</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.summary.nonBillableHours}h</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Status */}
        <div className="glass-card">
          <div className="section-title">Approval Status</div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(251,191,36,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#fbbf24" }}>
                  {data.approvalStats.pending}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Pending</div>
              </div>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(34,197,94,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#22c55e" }}>
                  {data.approvalStats.supervisor_approved + data.approvalStats.manager_approved}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Approved</div>
              </div>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#ef4444" }}>
                  {data.approvalStats.rejected}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Rejected</div>
              </div>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(167,139,250,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#a78bfa" }}>
                  {data.summary.streakCount}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Day Streak</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
