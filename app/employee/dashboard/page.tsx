"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityTracker from "@/app/components/ActivityTracker";
import AnalyticsDashboard from "@/app/components/AnalyticsDashboard";
import "./dashboard.css";
import "./dashboard.css";

type ScheduleToday = {
  hasSchedule: boolean;
  shift: {
    start_time: string;
    end_time: string;
    shift_name?: string | null;
  } | null;
};

type UserProfile = {
  user_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  dept_name: string | null;
  team_name: string | null;
  pos_name: string | null;
  streak_count: number | null;
};

/**
 * ✅ Strong emoji blocking:
 * - \p{Extended_Pictographic} catches most emoji pictographs
 * - Variation Selector-16 and ZWJ are used in emoji sequences
 */
const EMOJI_LIKE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

/**
 * ✅ Allowed characters ONLY:
 * letters (A-Z a-z), space, period, comma
 */
const ALLOWED_REASON_CHARS = /^[A-Za-z .,]*$/;

function sanitizeReasonInput(raw: string) {
  let s = raw ?? "";
  s = s.replace(EMOJI_LIKE, "");
  s = s.replace(/[^A-Za-z .,]/g, "");
  s = s.replace(/\s+/g, " ");
  if (s.length > 180) s = s.slice(0, 180);
  return s;
}

function formatClockDigits(d: Date) {
  return d
    .toLocaleTimeString([], {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .split(" ")[0];
}

function formatPeriod(d: Date) {
  return d.toLocaleTimeString([], { hour12: true, hour: "2-digit" }).slice(-2);
}

function formatDateLine(d: Date) {
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatScheduleRange(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "NO SCHEDULE TODAY";
  const s = new Date(startISO).toLocaleTimeString([], {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  });
  const e = new Date(endISO).toLocaleTimeString([], {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${s} — ${e}`.toUpperCase();
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function validateReasonClient(reason: string) {
  const r = (reason ?? "").trim();
  if (!r) return "Reason required";
  if (EMOJI_LIKE.test(r)) return "No emojis allowed";
  if (r.length > 180) return "Reason too long (max 180 chars)";
  if (!ALLOWED_REASON_CHARS.test(r)) return "Only letters, spaces, . and , are allowed";
  return null;
}

function initialsFrom(profile: UserProfile | null) {
  if (!profile) return "??";

  const a = (profile.first_name ?? "").trim();
  const b = (profile.last_name ?? "").trim();
  if (a || b) return `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase() || "??";

  const n = (profile.name ?? "").trim();
  if (!n) return "??";
  const parts = n.split(/\s+/).filter(Boolean);
  const i1 = parts[0]?.[0] ?? "?";
  const i2 = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${i1}${i2}`.toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();

  const [now, setNow] = useState(() => new Date());

  const [loading, setLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);

  const [scheduleToday, setScheduleToday] = useState<ScheduleToday>({
    hasSchedule: false,
    shift: null,
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [serverMsg, setServerMsg] = useState("");

  const [modalConfirm, setModalConfirm] = useState<"in" | "out" | null>(null);

  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState("");

  // ✅ Logout prompt modal after clock-out
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);

  // for timers
  const clockInTimeRef = useRef<number | null>(null);

  // theme
  const [lightMode, setLightMode] = useState(false);

  // prevent double submit
  const [actionBusy, setActionBusy] = useState(false);

  // Auto-logout inactivity while clocked out
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
  const inactivityTimerRef = useRef<number | null>(null);

  // ✅ Profile dropdown menu
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);

  // Active section for navigation
  const [activeSection, setActiveSection] = useState<"dashboard" | "analytics">("dashboard");

  // tick clock (UI)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // restore theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orasync-theme");
      const isLight = saved === "light";
      setLightMode(isLight);
      document.body.classList.toggle("light-mode", isLight);
    } catch { }
  }, []);

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.body.classList.toggle("light-mode", next);
    try {
      localStorage.setItem("orasync-theme", next ? "light" : "dark");
    } catch { }
  };

  const doLogout = useCallback(async () => {
    if (isClockedIn) {
      setServerMsg("Please clock out first before logging out.");
      return;
    }

    try {
      setActionBusy(true);
      setServerMsg("");
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
      window.location.href = "/login";
    }
  }, [isClockedIn]);

  // Load status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/clock/status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        const clocked = !!data?.isClockedIn;
        setIsClockedIn(clocked);

        const cin = data?.activeShift?.clock_in_time
          ? new Date(data.activeShift.clock_in_time).getTime()
          : null;
        clockInTimeRef.current = cin;

        setScheduleToday({
          hasSchedule: !!data?.scheduleToday?.hasSchedule,
          shift: data?.scheduleToday?.shift ?? null,
        });

        setUserProfile(data?.userProfile ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ DAILY SENTIMENT GATE (safety net even if user navigates directly)
  useEffect(() => {
    if (loading) return;

    (async () => {
      try {
        const res = await fetch("/api/employee/sentiment/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (data?.doneToday === false) {
          router.replace("/employee/sentiment");
        }
      } catch { }
    })();
  }, [loading, router]);

  const scheduleText = useMemo(() => {
    if (!scheduleToday.hasSchedule || !scheduleToday.shift) return "NO SCHEDULE TODAY";
    return formatScheduleRange(scheduleToday.shift.start_time, scheduleToday.shift.end_time);
  }, [scheduleToday]);

  const sidebarScheduleStatus = useMemo(
    () => (scheduleToday.hasSchedule ? "SCHEDULED" : "NO SCHEDULE"),
    [scheduleToday.hasSchedule]
  );

  const canClockIn = scheduleToday.hasSchedule && !loading && !actionBusy;

  const sessionDuration = useMemo(() => {
    if (!isClockedIn || !clockInTimeRef.current) return "00:00:00";
    return formatDuration(Date.now() - clockInTimeRef.current);
  }, [isClockedIn, now]);

  const targetHours = useMemo(() => {
    if (
      scheduleToday.hasSchedule &&
      scheduleToday.shift?.start_time &&
      scheduleToday.shift?.end_time
    ) {
      const s = new Date(scheduleToday.shift.start_time).getTime();
      const e = new Date(scheduleToday.shift.end_time).getTime();
      return formatDuration(Math.max(0, e - s));
    }
    return "09:00:00";
  }, [scheduleToday]);

  const isEarlyClockOut = useMemo(() => {
    if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) return false;
    const end = new Date(scheduleToday.shift.end_time).getTime();
    return Date.now() < end;
  }, [scheduleToday, now]);

  const doClockIn = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setServerMsg("");

    try {
      const res = await fetch("/api/employee/clock/in", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerMsg(data?.message ?? "Clock in failed");
        return;
      }

      const clockIn = data?.activeShift?.clock_in_time;
      setIsClockedIn(true);
      clockInTimeRef.current = clockIn ? new Date(clockIn).getTime() : Date.now();
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy]);

  const doClockOut = useCallback(
    async (earlyReason?: string) => {
      if (actionBusy) return;
      setActionBusy(true);
      setServerMsg("");

      try {
        const res = await fetch("/api/employee/clock/out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: earlyReason ?? "" }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setServerMsg(data?.message ?? "Clock out failed");
          return;
        }

        setIsClockedIn(false);
        clockInTimeRef.current = null;

        setReason("");
        setReasonErr("");
        setShowEarlyModal(false);

        // ✅ After clock out, ask if they want to logout
        setShowLogoutPrompt(true);
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy]
  );

  const confirmClockOutFlow = () => {
    if (actionBusy) return;

    if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) {
      void doClockOut("");
      return;
    }

    if (isEarlyClockOut) {
      setReason("");
      setReasonErr("");
      setShowEarlyModal(true);
      return;
    }

    void doClockOut("");
  };

  // ✅ realtime reason validation
  useEffect(() => {
    if (!showEarlyModal) return;
    const err = validateReasonClient(reason);
    setReasonErr(err ?? "");
  }, [reason, showEarlyModal]);

  const submitEarlyReason = () => {
    const err = validateReasonClient(reason);
    if (err) {
      setReasonErr(err);
      return;
    }
    void doClockOut(reason.trim());
  };

  // ✅ Auto logout after 30 minutes inactivity while clocked out
  useEffect(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (loading) return;
    if (isClockedIn) return;

    const reset = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        void doLogout();
      }, INACTIVITY_LIMIT_MS);
    };

    reset();

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    };
  }, [isClockedIn, loading, doLogout]);

  // ✅ Close profile menu on outside click + ESC
  useEffect(() => {
    if (!profileMenuOpen) return;

    const onDown = (e: MouseEvent) => {
      const wrap = profileMenuWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setProfileMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  const ledgerRows = useMemo(() => {
    const t = now.toLocaleTimeString([], {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!isClockedIn) return [];

    return [
      { code: "B", activity: "Work/Email", start: t, end: "…", endAccent: false },
      { code: "SYS", activity: "CLOCK IN", start: t, end: t, endAccent: true },
    ];
  }, [isClockedIn, now]);

  const profileNameText = useMemo(() => {
    const n =
      (userProfile?.name ?? "").trim() ||
      `${(userProfile?.first_name ?? "").trim()} ${(userProfile?.last_name ?? "")
        .trim()}`.trim();
    return n || "—";
  }, [userProfile]);

  const profileMetaText = useMemo(() => {
    const dept = (userProfile?.dept_name ?? "").trim();
    const team = (userProfile?.team_name ?? "").trim();
    const pos = (userProfile?.pos_name ?? "").trim();

    const left = dept || "—";
    const right = team || pos || "—";
    return `${left} | ${right}`;
  }, [userProfile]);

  const avatarText = useMemo(() => initialsFrom(userProfile), [userProfile]);

  // ✅ BLOCKING HANDLERS for reason input
  const onReasonBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const ev = e.nativeEvent as InputEvent;
    const data = ev.data ?? "";
    if (!data) return;

    if (EMOJI_LIKE.test(data) || !ALLOWED_REASON_CHARS.test(data)) {
      e.preventDefault();
      return;
    }

    const current = reason ?? "";
    if ((current + data).length > 180) {
      e.preventDefault();
    }
  };

  const onReasonPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const sanitized = sanitizeReasonInput((reason ?? "") + text);
    setReason(sanitized);
  };

  const onReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeReasonInput(e.target.value);
    setReason(next);
  };

  return (
    <>
      <div className="tech-mesh" />

      <div className="split-layout">
        <aside className="info-panel">
          <div className="bg-decor bg-sq-outline sq-top-left" />
          <div className="bg-decor bg-sq-outline sq-mid-left" />
          <div className="bg-decor bg-sq-solid sq-bot-left" />

          <div className="brand-logo">ORASync</div>

          <ul className="nav-links">
            <li className="nav-item active">Dashboard</li>
            <li className="nav-item">Calendar</li>
            <li className="nav-item">Timesheet</li>
            <li className="nav-item">Analytics</li>
          </ul>

          <div className="widget-box">
            <div className="label-sm">TODAY&apos;S SCHEDULE</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)" }}>
              {scheduleText}
            </div>
            <div className="status-badge go">
              <span className={`dot ${scheduleToday.hasSchedule ? "go" : "warn"}`} />
              <span style={{ marginLeft: 8 }}>{sidebarScheduleStatus}</span>
            </div>
          </div>

          {profileMenuOpen && (
            <div className="profile-menu active">
              <div
                className="menu-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setServerMsg("Settings is UI-only for now.");
                }}
              >
                <span className="menu-icon">⚙</span> Settings
              </div>
              <div className="menu-divider" />
              <div
                className="menu-item danger"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void doLogout();
                }}
              >
                <span className="menu-icon">⎋</span> Log Out
              </div>
            </div>
          )}

          <div
            className="profile-card"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            title="Click for menu"
          >
            <div className="streak-badge">🔥 {userProfile?.streak_count ?? 12} Day Streak</div>
            <div className="avatar">{avatarText}</div>
            <div className="profile-info">
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>
                {profileNameText || "User"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {profileMetaText}
              </div>
            </div>
          </div>

          {serverMsg && <div style={{ color: "var(--color-warn)", marginTop: 10, fontSize: "0.8rem", padding: "0 10px" }}>{serverMsg}</div>}
        </aside>

        <main className="workspace-panel">
          <div className="top-bar" style={{ justifyContent: "space-between", padding: "20px 30px" }}>
            <div className="status-badge go" style={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}>
              <span className="dot go" />
              <span style={{ marginLeft: 10, fontSize: "0.8rem", letterSpacing: "2px", fontWeight: "bold", color: "#4ade80" }}>SYSTEM ONLINE</span>
            </div>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle Theme">
              {lightMode ? "☀" : "🌙"}
            </button>
          </div>


          <div className="content-area">
            {!isClockedIn ? (
              <div id="layout-initial" className="fade-in" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="landing-card">
                  <div className="hero-clock-label">Current Time</div>
                  <div className="hero-clock-row">
                    {now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }).split(" ")[0]}
                    <span className="clock-ampm">
                      {now.toLocaleTimeString("en-US", { hour12: true }).split(" ")[1]}
                    </span>
                  </div>
                  <div className="hero-date-display">
                    {formatDateLine(now)}
                  </div>

                  <button className="btn-clock-in-large" onClick={() => doClockIn()}>
                    CLOCK IN
                  </button>
                </div>
              </div>
            ) : (
              <div className="section-view fade-in">
                <div className="hud-row">
                  <div className="hud-card">
                    <div className="hud-bg-icon">⏱</div>
                    <div className="hud-label">CURRENT TIME</div>
                    <div className="hud-val accent-cyan">
                      {now.toLocaleTimeString([], { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: 2 }}>
                      {formatDateLine(now)}
                    </div>
                  </div>
                  <div className="hud-card">
                    <div className="hud-bg-icon">⚡</div>
                    <div className="hud-label">SESSION DURATION</div>
                    <div className="hud-val">
                      {sessionDuration}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 5, fontFamily: "var(--font-mono)" }}>
                      Target: {targetHours}
                    </div>
                  </div>
                  <div className="hud-card" style={{ borderColor: "var(--accent-blue)" }}>
                    <div className="hud-bg-icon">🔥</div>
                    <div className="hud-label">ACTIVITY DURATION</div>
                    <div className="hud-val warn">
                      {sessionDuration}
                    </div>
                    <div className="status-badge warn" style={{ marginTop: 5, alignSelf: "flex-start", fontSize: "0.7rem" }}>
                      Active Task
                    </div>
                  </div>
                </div>

                <div className="workspace-grid">
                  <div className="logs-panel">
                    <div className="section-title">
                      <span>Activity Ledger</span>
                      <span className="live-updates-badge">LIVE UPDATES</span>
                    </div>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Activity</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerRows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.code}</td>
                              <td style={{ fontWeight: 700 }}>{r.activity}</td>
                              <td>{r.start}</td>
                              <td className={r.endAccent ? "td-accent" : ""}>{r.end}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="controls-panel">
                    <div className="glass-card" style={{ flex: 1 }}>
                      <div className="section-title">Action Panel</div>
                      <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: "0.9rem" }}>
                        Switch tasks below. Time is logged automatically.
                      </p>

                      <ActivityTracker isClockedIn={isClockedIn} />

                      <div className="ap-divider" />

                      <div style={{ marginTop: "auto" }}>
                        <div className="label-sm">SESSION STATUS</div>
                        <div className="session-status-box" style={{ marginBottom: 20 }}>
                          CLOCKED IN
                        </div>

                        <button
                          className="btn-ap-danger"
                          onClick={() => setModalConfirm("out")}
                        >
                          CLOCK OUT
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODALS */}
      {modalConfirm === "out" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Confirm Clock Out?</div>
            <p style={{ color: "var(--text-muted)" }}>Are you sure you want to end your shift?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalConfirm(null)}>Cancel</button>
              <button className="btn-confirm" onClick={confirmClockOutFlow}>Clock Out</button>
            </div>
          </div>
        </div>
      )}

      {showEarlyModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Early Clock Out</div>
            <p style={{ color: "var(--text-muted)", marginBottom: 15 }}>
              You are clocking out before your schedule ends. Please provide a reason.
            </p>
            <input
              className="input-rounded"
              placeholder="Reason..."
              value={reason}
              onChange={onReasonChange}
              onPaste={onReasonPaste}
              onBeforeInput={(e: any) => onReasonBeforeInput(e)}
            />
            {reasonErr && <div style={{ color: "var(--color-urgent)", marginTop: 5, fontSize: "0.8rem" }}>{reasonErr}</div>}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowEarlyModal(false)}>Cancel</button>
              <button className="btn-confirm" onClick={submitEarlyReason}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutPrompt && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Shift Ended</div>
            <p style={{ marginBottom: 20, color: "var(--text-muted)" }}>Do you want to log out now?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutPrompt(false)}>
                Stay Here
              </button>
              <button className="btn-confirm" onClick={() => void doLogout()}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
