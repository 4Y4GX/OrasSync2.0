"use client";

import { useState, useEffect } from "react";

export default function Calendar({ userId }: { userId: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendar, setCalendar] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    async function loadCalendar() {
      if (!userId) return;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/calendar?userId=${encodeURIComponent(userId)}&year=${year}&month=${month}`
        );
        
        if (!response.ok) {
          console.error("API Route not found or error occurred");
          setLoading(false);
          return;
        }

        const data = await response.json();
        const map: Record<string, any> = {};
        if (Array.isArray(data)) {
          data.forEach((item) => {
            map[item.date] = item;
          });
        }
        setCalendar(map);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCalendar();
  }, [userId, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="glass-card">
      <div className="calendar-header-bar">
        <button className="cal-nav-btn" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>◀</button>
        <h3>{currentDate.toLocaleString("default", { month: "long", year: "numeric" })}</h3>
        <button className="cal-nav-btn" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>▶</button>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <strong key={d} style={{ textAlign: "center" }}>{d}</strong>
        ))}
        
        {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}

        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const data = calendar[key];

          return (
            <div key={day} className={`cal-day ${data?.off === false ? "has-shift" : ""}`}>
              <div className="cal-date-num">{day}</div>
              {data && !data.off && (
                <div className="shift-info">
                  <div style={{ fontWeight: "bold" }}>{data.shift_name}</div>
                  <div style={{ fontSize: "0.75rem" }}>{data.start_time}-{data.end_time}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}