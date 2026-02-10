"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManagerClock() {
  const [status, setStatus] = useState<"IDLE" | "WORKING">("IDLE");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. Check status on load (You might need a separate API to fetch current status, 
  // or pass it in as a prop. For now, we assume IDLE or save to localStorage)
  useEffect(() => {
    const storedStart = localStorage.getItem("manager_clock_start");
    if (storedStart) {
      setStatus("WORKING");
      setStartTime(new Date(storedStart));
    }
  }, []);

  // 2. Timer Logic
  useEffect(() => {
    if (status !== "WORKING" || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - startTime.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startTime]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/clock/in", { method: "POST" });
      if (res.ok) {
        const now = new Date();
        setStatus("WORKING");
        setStartTime(now);
        localStorage.setItem("manager_clock_start", now.toISOString());
        router.refresh();
      } else {
        alert("Failed to clock in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/clock/out", { method: "POST" });
      if (res.ok) {
        setStatus("IDLE");
        setStartTime(null);
        setElapsed("00:00:00");
        localStorage.removeItem("manager_clock_start");
        router.refresh();
      } else {
        alert("Failed to clock out");
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toLocaleDateString("en-US", { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
            {today}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {elapsed}
          </div>
          <div style={{ fontSize: "0.85rem", color: status === "WORKING" ? "var(--color-go)" : "var(--text-muted)" }}>
            {status === "WORKING" ? "Currently Working" : "Not Clocked In"}
          </div>
        </div>

        {status === "IDLE" ? (
          <button 
            className="btn" 
            style={{ backgroundColor: "var(--color-go)", color: "white", padding: "0.8rem 1.5rem" }}
            onClick={handleClockIn}
            disabled={loading}
          >
            {loading ? "..." : "CLOCK IN"}
          </button>
        ) : (
          <button 
            className="btn" 
            style={{ backgroundColor: "var(--color-stop)", color: "white", padding: "0.8rem 1.5rem" }}
            onClick={handleClockOut}
            disabled={loading}
          >
             {loading ? "..." : "CLOCK OUT"}
          </button>
        )}
      </div>
    </div>
  );
}