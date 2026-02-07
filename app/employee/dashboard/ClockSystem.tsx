"use client";

import { useState, useEffect } from "react";

interface ClockProps {
  isClockedIn: boolean;
  canClockIn: boolean;
  scheduleLabel: string;
  onClockIn: () => void;
  onClockOutRequest: () => void;
}

export default function ClockSystem({
  isClockedIn,
  canClockIn,
  scheduleLabel,
  onClockIn,
  onClockOutRequest,
}: ClockProps) {
  const [time, setTime] = useState(new Date());
  const [confirmType, setConfirmType] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeString = time
    .toLocaleTimeString([], { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .replace(":", ":");

  const period = time.toLocaleTimeString([], { hour12: true, hour: "2-digit" }).slice(-2);

  const dateString = time.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="glass-card fade-in" style={{ maxWidth: 760, width: "100%" }}>
      <div className="section-title">SYSTEM TIME • PHT</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: "2.3rem", fontWeight: 800, fontFamily: "monospace" }}>
          {timeString.split(" ")[0]}
        </div>
        <div style={{ fontSize: "1.1rem", fontWeight: 800, opacity: 0.85 }}>{period}</div>
      </div>

      <div className="label-sm" style={{ marginBottom: 12 }}>
        {dateString}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          padding: "10px 12px",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div className="label-sm" style={{ marginBottom: 0 }}>
          {scheduleLabel}
        </div>

        <div className="status-badge" style={{ marginTop: 0 }}>
          <span className={`dot ${isClockedIn ? "go" : "urgent"}`} />
          {isClockedIn ? "CLOCKED IN" : "CLOCKED OUT"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <button
          className="btn-action btn-go"
          disabled={isClockedIn || !canClockIn}
          onClick={() => setConfirmType("in")}
          title={!canClockIn ? "No schedule today" : ""}
        >
          CLOCK IN
        </button>

        <button
          className="btn-action btn-urgent"
          disabled={!isClockedIn}
          onClick={() => setConfirmType("out")}
        >
          CLOCK OUT
        </button>
      </div>

      {/* confirm modal */}
      {confirmType && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: 520 }}>
            <div className={`modal-header ${confirmType === "out" ? "header-urgent" : "header-normal"}`}>
              <span style={{ fontSize: "1.4rem" }}>{confirmType === "out" ? "⚠️" : "✅"}</span>
              <span className="modal-title">
                {confirmType === "out" ? "Confirm Clock Out" : "Confirm Clock In"}
              </span>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                {confirmType === "out"
                  ? "Are you sure you want to clock out? If you clock out earlier than your scheduled end time, a justification will be required."
                  : "Start your shift now?"}
              </p>
            </div>

            <div className="modal-footer" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button className="btn-action" onClick={() => setConfirmType(null)}>
                Cancel
              </button>

              <button
                className={`btn-action ${confirmType === "out" ? "btn-urgent" : "btn-go"}`}
                onClick={() => {
                  const type = confirmType;
                  setConfirmType(null);

                  if (type === "in") onClockIn();
                  if (type === "out") onClockOutRequest();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
