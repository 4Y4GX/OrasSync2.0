"use client";

import { useEffect, useMemo, useState } from "react";

type TimesheetDay = {
  date: string;
  clocks: Array<{
    clock_id: number;
    clock_in_time: string | null;
    clock_out_time: string | null;
    is_early_leave: boolean;
    early_reason: string | null;
  }>;
  activities: Array<{
    tlog_id: number;
    activity_id: number | null;
    activity_name: string | null;
    start_time: string | null;
    end_time: string | null;
    total_hours: any;
    approval_status: string | null;
    rejection_reason: string | null;
  }>;
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString();
}

export default function TimesheetPage() {

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<TimesheetDay[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<'all' | 'pending' | 'rejected'>('all');

  // last 7 days by default
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });

  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = async (status?: 'pending' | 'rejected') => {
    setLoading(true);
    setError("");

    try {
      let url = `/api/employee/timesheet?from=${from}&to=${to}`;
      if (status === 'pending' || status === 'rejected') {
        url += `&status=${status}`;
      }
      const res = await fetch(url, {
        cache: "no-store",
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        const msg =
          data?.message ??
          `API error ${res.status} ${res.statusText}: ${raw?.slice(0, 220) || "(empty response)"}`;
        setError(msg);
        return;
      }

      setDays(Array.isArray(data?.days) ? data.days : []);
    } catch {
      setError("Network/Fetch failed (server down or route crashed before responding).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(tab === 'all' ? undefined : tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to]);

  const rows = useMemo(() => days, [days]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: 0.5 }}>
          Timesheet
        </h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          This page is for QA/testing: it shows clock in/out and early clock-out reasons.
        </p>

        {/* Detailed Logs Section */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Detailed Logs</div>
          {/* Tabs for filtering logs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setTab('all')}
              style={{
                padding: '8px 18px',
                fontWeight: 700,
                borderRadius: 8,
                border: tab === 'all' ? '2px solid #a78bfa' : '1px solid #ccc',
                background: tab === 'all' ? '#ede9fe' : '#fff',
                color: tab === 'all' ? '#6d28d9' : '#222',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              All
            </button>
            <button
              onClick={() => setTab('pending')}
              style={{
                padding: '8px 18px',
                fontWeight: 700,
                borderRadius: 8,
                border: tab === 'pending' ? '2px solid #fbbf24' : '1px solid #ccc',
                background: tab === 'pending' ? '#fef3c7' : '#fff',
                color: tab === 'pending' ? '#b45309' : '#222',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Pending
            </button>
            <button
              onClick={() => setTab('rejected')}
              style={{
                padding: '8px 18px',
                fontWeight: 700,
                borderRadius: 8,
                border: tab === 'rejected' ? '2px solid #ef4444' : '1px solid #ccc',
                background: tab === 'rejected' ? '#fee2e2' : '#fff',
                color: tab === 'rejected' ? '#b91c1c' : '#222',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Rejected
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>From</div>
              <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>To</div>
              <input value={to} onChange={(e) => setTo(e.target.value)} type="date" />
            </div>

            <button onClick={() => fetchData(tab === 'all' ? undefined : tab)} style={{ padding: "10px 14px", cursor: "pointer", fontWeight: 800 }}>
              Load
            </button>
          </div>

          {loading && <div style={{ marginTop: 16, opacity: 0.75 }}>Loading…</div>}
          {error && <div style={{ marginTop: 16, color: "crimson", fontWeight: 700 }}>{error}</div>}

          {!loading && !error && (
            <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
              {rows.map((day) => {
                const hasClock = day.clocks.length > 0;
                const latestClock = hasClock ? day.clocks[0] : null;

                return (
                  <div
                    key={day.date}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{day.date}</div>
                      <div style={{ opacity: 0.8, fontWeight: 700 }}>
                        Activities: {day.activities.length} | Clock logs: {day.clocks.length}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Latest Clock Log</div>
                      {!latestClock ? (
                        <div style={{ opacity: 0.75 }}>No clock log for this day.</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Clock In</div>
                            <div style={{ fontWeight: 800 }}>{fmt(latestClock.clock_in_time)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Clock Out</div>
                            <div style={{ fontWeight: 800 }}>{fmt(latestClock.clock_out_time)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Early?</div>
                            <div style={{ fontWeight: 900 }}>
                              {latestClock.is_early_leave ? "YES" : "NO"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Reason</div>
                            <div style={{ fontWeight: 700 }}>
                              {latestClock.early_reason?.trim() ? latestClock.early_reason : "—"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {day.clocks.length > 1 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>All Clock Logs (same day)</div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                            <thead>
                              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                                <th style={{ padding: 10 }}>Clock ID</th>
                                <th style={{ padding: 10 }}>Clock In</th>
                                <th style={{ padding: 10 }}>Clock Out</th>
                                <th style={{ padding: 10 }}>Early?</th>
                                <th style={{ padding: 10 }}>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {day.clocks.map((c) => (
                                <tr key={`${day.date}-${c.clock_id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                  <td style={{ padding: 10, fontWeight: 800 }}>{c.clock_id}</td>
                                  <td style={{ padding: 10 }}>{fmt(c.clock_in_time)}</td>
                                  <td style={{ padding: 10 }}>{fmt(c.clock_out_time)}</td>
                                  <td style={{ padding: 10, fontWeight: 900 }}>{c.is_early_leave ? "YES" : "NO"}</td>
                                  <td style={{ padding: 10 }}>{c.early_reason ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div style={{ padding: 12, opacity: 0.75 }}>
                  No timesheet data in selected range.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
