"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityTracker from "@/app/components/ActivityTracker";
import AnalyticsDashboard from "@/app/components/AnalyticsDashboard";
import Calendar from "@/app/components/calendar";
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

/**
 * ✅ NEW HELPER: Formats ISO strings to just Time (e.g., "09:00 AM")
 * preventing the display of "1970-01-01"
 */
function formatShiftTime(isoString: string) {
  if (!isoString) return "";
  // If it's already a simple time (e.g. "09:00"), return it
  if (!isoString.includes("T")) return isoString;

  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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
  // Updated to use the new helper
  return `${formatShiftTime(startISO)} — ${formatShiftTime(endISO)}`.toUpperCase();
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
  const [ledgerData, setLedgerData] = useState<any[]>([]); // ✅ NEW: State for ledger data

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
  const [reasonShake, setReasonShake] = useState(false);

  // ✅ Logout prompt modal after clock-out
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);

  // for timers - clock in time as state for reactive updates
  const [clockInTime, setClockInTime] = useState<number | null>(null);
  // Accumulated worked time from previous sessions today (in milliseconds)
  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);

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
  const [activeSection, setActiveSection] = useState<"dashboard" | "calendar" | "timesheet" | "analytics">("dashboard");

  /* --- ANALYTICS STATE --- */
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsWeekOffset, setAnalyticsWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

  /* --- TIMESHEET STATE --- */
  const [timesheetDays, setTimesheetDays] = useState<any[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* --- CALENDAR STATE --- */
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [calDate, setCalDate] = useState(() => new Date());

  /* --- CALENDAR STATE & FETCH --- */
  const [calendar, setCalendar] = useState<Record<string, any>>({});

  /* --- FUTURE ACTIVITY STATE --- */
  const [futureSchedules, setFutureSchedules] = useState<Record<string, any[]>>({});
  const [activityList, setActivityList] = useState<any[]>([]);
  const [showFutureModal, setShowFutureModal] = useState(false);
  const [futureModalDate, setFutureModalDate] = useState("");
  const [futureModalActivity, setFutureModalActivity] = useState("");
  const [futureModalStartTime, setFutureModalStartTime] = useState("");
  const [futureModalEndTime, setFutureModalEndTime] = useState("");
  const [futureModalError, setFutureModalError] = useState("");
  const [futureModalSaving, setFutureModalSaving] = useState(false);
  const [futureModalShiftTimes, setFutureModalShiftTimes] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    const fetchCalendar = async () => {
      if (!userProfile?.user_id) return;

      try {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();

        // ✅ Corrected URL Path
        const res = await fetch(`/api/calendar?userId=${userProfile.user_id}&year=${year}&month=${month}`);

        if (!res.ok) {
          console.error("Calendar API returned error:", res.status);
          return;
        }

        const data = await res.json();

        const map: Record<string, any> = {};
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            map[item.date] = item;
          });
        }
        setCalendar(map);
      } catch (err) {
        console.error("Failed to fetch calendar", err);
      }
    };

    fetchCalendar();
  }, [userProfile?.user_id, calDate]);

  const calNavigate = (dir: number) => {
    const next = new Date(calDate);
    if (calView === 'week') next.setDate(next.getDate() + (dir * 7));
    else next.setMonth(next.getMonth() + dir);
    setCalDate(next);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getCalendarTitle = () => {
    if (calView === 'week') {
      const start = new Date(calDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${monthNames[start.getMonth()].substring(0, 3)} ${start.getDate()} — ${monthNames[end.getMonth()].substring(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;
  };

  // Fetch activities list for future scheduling
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch("/api/employee/activity/list");
        if (res.ok) {
          const data = await res.json();
          setActivityList(data.activities || []);
        }
      } catch (err) {
        console.error("Failed to fetch activities", err);
      }
    };
    fetchActivities();
  }, []);

  // Fetch future schedules
  useEffect(() => {
    const fetchFutureSchedules = async () => {
      if (!userProfile?.user_id) return;
      try {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const res = await fetch(`/api/employee/schedule/future?userId=${userProfile.user_id}&year=${year}&month=${month}`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, any[]> = {};
          if (data.schedules && Array.isArray(data.schedules)) {
            data.schedules.forEach((schedule: any) => {
              const dateKey = schedule.shift_date;
              if (!map[dateKey]) map[dateKey] = [];
              map[dateKey].push(schedule);
            });
          }
          setFutureSchedules(map);
        }
      } catch (err) {
        console.error("Failed to fetch future schedules", err);
      }
    };
    fetchFutureSchedules();
  }, [userProfile?.user_id, calDate]);

  // Future activity modal handlers
  const openFutureModal = (dateKey?: string) => {
    setFutureModalError("");
    setFutureModalActivity("");
    setFutureModalStartTime("");
    setFutureModalEndTime("");
    
    if (dateKey) {
      setFutureModalDate(dateKey);
      const dayData = calendar[dateKey];
      if (dayData && !dayData.off) {
        setFutureModalShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setFutureModalStartTime(dayData.start_time);
        setFutureModalEndTime(dayData.end_time);
      }
    } else {
      setFutureModalDate("");
      setFutureModalShiftTimes(null);
    }
    
    setShowFutureModal(true);
  };

  const closeFutureModal = () => {
    setShowFutureModal(false);
    setFutureModalError("");
    setFutureModalDate("");
    setFutureModalActivity("");
    setFutureModalStartTime("");
    setFutureModalEndTime("");
    setFutureModalShiftTimes(null);
  };

  // Close future modal on Escape key
  useEffect(() => {
    if (!showFutureModal) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFutureModal();
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showFutureModal]);

  const handleFutureDateChange = (newDate: string) => {
    setFutureModalDate(newDate);
    setFutureModalError("");
    
    if (calendar[newDate]) {
      const dayData = calendar[newDate];
      if (!dayData.off && dayData.start_time && dayData.end_time) {
        setFutureModalShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setFutureModalStartTime(dayData.start_time);
        setFutureModalEndTime(dayData.end_time);
      } else {
        setFutureModalShiftTimes(null);
        setFutureModalStartTime("");
        setFutureModalEndTime("");
        setFutureModalError("No shift scheduled for this day");
      }
    } else {
      setFutureModalShiftTimes(null);
      setFutureModalStartTime("");
      setFutureModalEndTime("");
    }
  };

  const submitFutureActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFutureModalError("");

    if (!futureModalDate || !futureModalActivity || !futureModalStartTime || !futureModalEndTime) {
      setFutureModalError("Please fill in all fields");
      return;
    }

    setFutureModalSaving(true);
    try {
      const res = await fetch("/api/employee/schedule/future", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: futureModalActivity,
          shift_date: futureModalDate,
          start_time: futureModalStartTime,
          end_time: futureModalEndTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFutureModalError(data.message || "Failed to save activity");
        return;
      }

      // Refresh future schedules
      const year = calDate.getFullYear();
      const month = calDate.getMonth();
      const refreshRes = await fetch(`/api/employee/schedule/future?userId=${userProfile?.user_id}&year=${year}&month=${month}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const map: Record<string, any[]> = {};
        if (refreshData.schedules && Array.isArray(refreshData.schedules)) {
          refreshData.schedules.forEach((schedule: any) => {
            const dateKey = schedule.shift_date;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(schedule);
          });
        }
        setFutureSchedules(map);
      }
      closeFutureModal();
    } catch (err) {
      setFutureModalError("An error occurred while saving");
    } finally {
      setFutureModalSaving(false);
    }
  };

  const deleteFutureActivity = async (ftsId: number) => {
    if (!confirm("Are you sure you want to delete this scheduled activity?")) return;
    
    try {
      const res = await fetch(`/api/employee/schedule/future?fts_id=${ftsId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Refresh future schedules
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const refreshRes = await fetch(`/api/employee/schedule/future?userId=${userProfile?.user_id}&year=${year}&month=${month}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const map: Record<string, any[]> = {};
          if (refreshData.schedules && Array.isArray(refreshData.schedules)) {
            refreshData.schedules.forEach((schedule: any) => {
              const dateKey = schedule.shift_date;
              if (!map[dateKey]) map[dateKey] = [];
              map[dateKey].push(schedule);
            });
          }
          setFutureSchedules(map);
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

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

  // Fetch Logs (Timesheet)
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/timesheet");
      const data = await res.json();
      if (res.ok && data.days) {
        setTimesheetDays(data.days);
      }
    } catch (e) {
      console.error("Failed to fetch timesheet", e);
    }
  }, []);

  // Submit Timesheet for Review
  const submitTimesheet = useCallback(async () => {
    // Collect all pending tlog_ids from timesheetDays
    const allTlogIds: number[] = [];
    for (const day of timesheetDays) {
      for (const act of day.activities || []) {
        if (act.approval_status === "PENDING" && act.tlog_id) {
          allTlogIds.push(act.tlog_id);
        }
      }
    }

    if (allTlogIds.length === 0) {
      setSubmitMsg({ type: "error", text: "No pending time logs to submit" });
      return;
    }

    setSubmitLoading(true);
    setSubmitMsg(null);

    try {
      const res = await fetch("/api/employee/timesheet/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tlog_ids: allTlogIds }),
      });

      const data = await res.json();

      if (res.ok) {
        // Build summary message
        const shiftSummary = (data.by_shift || [])
          .map((s: any) => `${s.shift_name}: ${s.logs_submitted} log(s)`)
          .join(", ");
        setSubmitMsg({
          type: "success",
          text: `Submitted ${data.submitted_count} log(s) for review. ${shiftSummary}`,
        });
        // Refresh timesheet data
        await fetchLogs();
      } else {
        setSubmitMsg({ type: "error", text: data.message || "Submission failed" });
      }
    } catch (e) {
      console.error("Submit timesheet error:", e);
      setSubmitMsg({ type: "error", text: "Failed to submit timesheet" });
    } finally {
      setSubmitLoading(false);
    }
  }, [timesheetDays, fetchLogs]);

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
        setClockInTime(cin);

        // Set accumulated time from previous sessions today
        setAccumulatedMs(data?.accumulatedMs ?? 0);

        setScheduleToday({
          hasSchedule: !!data?.scheduleToday?.hasSchedule,
          shift: data?.scheduleToday?.shift ?? null,
        });

        setUserProfile(data?.userProfile ?? null);
      } finally {
        setLoading(false);
      }
    })();
    // Fetch logs initially too
    fetchLogs();
  }, [fetchLogs]);

  // ✅ DAILY SENTIMENT GATE
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

  // ✅ NEW: Fetch ledger data when clocked in
  useEffect(() => {
    if (!isClockedIn) {
      setLedgerData([]);
      return;
    }

    const fetchLedger = async () => {
      try {
        const res = await fetch("/api/employee/activity/ledger", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setLedgerData(data.ledger || []);
      } catch (error) {
        console.error("Failed to fetch ledger:", error);
      }
    };

    fetchLedger();

    // Refresh ledger every 5 seconds while clocked in
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, [isClockedIn]);

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
    // If clocked in, show accumulated time + current session time
    if (isClockedIn && clockInTime) {
      const currentSessionMs = Date.now() - clockInTime;
      return formatDuration(accumulatedMs + currentSessionMs);
    }
    // If not clocked in but have accumulated time today, show that
    if (accumulatedMs > 0) {
      return formatDuration(accumulatedMs);
    }
    return "00:00:00";
  }, [isClockedIn, clockInTime, accumulatedMs, now]);

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
      setClockInTime(clockIn ? new Date(clockIn).getTime() : Date.now());
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

        // Add current session time to accumulated before clearing
        if (clockInTime) {
          const currentSessionMs = Date.now() - clockInTime;
          setAccumulatedMs(prev => prev + currentSessionMs);
        }

        setIsClockedIn(false);
        setClockInTime(null);

        setReason("");
        setReasonErr("");
        setShowEarlyModal(false);

        // ✅ After clock out, ask if they want to logout
        setShowLogoutPrompt(true);
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, clockInTime]
  );

  const confirmClockOutFlow = () => {
    if (actionBusy) return;

    // Close the confirmation modal first
    setModalConfirm(null);

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
      setReasonShake(true);
      setTimeout(() => setReasonShake(false), 500);
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

  /* --- ANALYTICS DATA FETCHING --- */
  useEffect(() => {
    if (activeSection !== "analytics") return;

    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        // Calculate the Monday of the selected week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));
        const startDate = currentMonday.toISOString().split('T')[0];
        
        const res = await fetch(`/api/analytics/dashboard?period=week&startDate=${startDate}`);
        if (res.ok) {
          const data = await res.json();
          setAnalyticsData(data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    void fetchAnalytics();
  }, [activeSection, analyticsWeekOffset]);

  /* --- REAL LEDGER DATA REPLACES MOCK --- */
  const ledgerRows = useMemo(() => {
    // Return empty if not clocked in or no data
    if (!isClockedIn || !ledgerData || ledgerData.length === 0) {
      return [];
    }

    return ledgerData.map((log: any) => ({
      code: log.activity_code || "ACT",
      activity: log.activity_name || "Unknown",
      start: log.start_time ? formatShiftTime(log.start_time) : "",
      end: log.end_time ? formatShiftTime(log.end_time) : "...",
      endAccent: !!log.is_active,
      // Optional: sort if needed, assuming data comes compliant or we map specific fields
    }));
  }, [isClockedIn, ledgerData]);

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
            <li className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}>Dashboard</li>
            <li className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}>Calendar</li>
            <li className={`nav-item ${activeSection === 'timesheet' ? 'active' : ''}`} onClick={() => setActiveSection('timesheet')}>Timesheet</li>
            <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`} onClick={() => setActiveSection('analytics')}>Analytics</li>
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

          <div ref={profileMenuWrapRef} style={{ position: "relative" }}>
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
              <div className="section-view fade-in" key={activeSection}>
                <div className="section-animate">
                  {activeSection === 'dashboard' && (
                    <>
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

                            <ActivityTracker isClockedIn={isClockedIn} onActivityChange={fetchLogs} />

                            <div className="ap-divider" />

                            <div style={{ marginTop: "auto" }}>
                              <div className="label-sm">SESSION STATUS</div>
                              <div className="session-status-box" style={{ marginBottom: 10 }}>
                                CLOCKED IN
                              </div>
                              {clockInTime && (
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 20 }}>
                                  Since {new Date(clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              )}

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
                    </>
                  )}

                  {activeSection === 'timesheet' && (
                    <div className="ts-split">

                      {/* LEFT PANEL: TIMELINE */}
                      <div className="ts-left">
                        <div className="glass-card" style={{ padding: 20, height: "100%", display: "flex", flexDirection: "column" }}>
                          <div className="section-title"
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <span>Timeline Visualization</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                              <div style={{ display: "flex", gap: 15, marginRight: 15, borderRight: "1px solid var(--border-subtle)", paddingRight: 15 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 10, height: 10, background: "var(--accent-blue)", borderRadius: 2, boxShadow: "0 0 5px var(--accent-blue)" }} />
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>BILLABLE</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 10, height: 10, background: "var(--color-warn)", borderRadius: 2, boxShadow: "0 0 5px var(--color-warn)" }} />
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>NON-BILLABLE</span>
                                </div>
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>24 HOUR SCALE</span>
                            </div>
                          </div>

                          <div className="gantt-chart-container">
                            <div className="grid-lines">
                              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(h => (
                                <div key={h} className="grid-line" style={{ left: `${(h / 24) * 100}%` }} />
                              ))}
                            </div>
                            <div className="timeline-header">
                              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(h => {
                                const lab = h === 0 || h === 24 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                                return (
                                  <div key={h} className="time-marker" style={{ left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>{lab}</div>
                                );
                              })}
                            </div>

                            <div id="gantt-body">
                              {timesheetDays.map((day) => (
                                day.activities.map((act: any, idx: number) => {
                                  if (!act.start_time || !act.end_time) return null;
                                  
                                  // Parse HH:MM string format
                                  const parseTime = (t: string) => {
                                    const [hh, mm] = t.split(':').map(Number);
                                    return hh * 60 + mm;
                                  };
                                  
                                  const startMin = parseTime(act.start_time);
                                  let endMin = parseTime(act.end_time);

                                  if (endMin < startMin) endMin += 1440; // Overnight

                                  const totalMin = 1440;
                                  const left = (startMin / totalMin) * 100;
                                  const width = ((endMin - startMin) / totalMin) * 100;

                                  const barClass = act.is_billable ? 'bar-B' : 'bar-NB';

                                  return (
                                    <div key={`${day.date}-${idx}`} className="gantt-row">
                                      <div className="gantt-label" title={act.activity_name}>{act.activity_name}</div>
                                      <div className="gantt-track">
                                        <div className={`gantt-bar ${barClass}`} style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}>
                                          <div className="gantt-tooltip">
                                            <strong>{act.start_time} - {act.end_time}</strong>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })
                              ))}
                              {(!timesheetDays.length || !timesheetDays.some(d => d.activities && d.activities.length > 0)) && (
                                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", position: "absolute", top: "50%", left: 0, width: "100%", transform: "translateY(-50%)" }}>
                                  <div style={{ marginBottom: 10, fontSize: "1.5rem", opacity: 0.5 }}>📊</div>
                                  No activity data recorded yet.
                                  {activeSection === 'timesheet' && (
                                    <div style={{ marginTop: 10, fontSize: "0.8rem" }}>(Clock in to start tracking)</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT PANEL: LOGS */}
                      <div className="ts-right">
                        <div className="glass-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
                          <div className="section-title" style={{ padding: 20 }}>Detailed Logs</div>
                          <div className="table-container" style={{ flex: 1, overflowY: "auto" }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th style={{ minWidth: 130 }}>Date</th>
                                  <th>Activity Name</th>
                                  <th>Start</th>
                                  <th>End</th>
                                  <th>Duration</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {timesheetDays.map(day => (
                                  day.activities.map((act: any, idx: number) => (
                                    <tr key={`${day.date}-${idx}-tr`}>
                                      <td>{day.date}</td>
                                      <td style={{ fontWeight: 600 }}>{act.activity_name}</td>
                                      <td>{act.start_time || "-"}</td>
                                      <td>{act.end_time || "..."}</td>
                                      <td>{act.total_hours ? Number(act.total_hours).toFixed(2) + "h" : "-"}</td>
                                      <td>
                                        <span style={{
                                          padding: "2px 8px",
                                          borderRadius: 4,
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          backgroundColor: act.approval_status === "PENDING" ? "rgba(234, 179, 8, 0.2)" : 
                                                          act.approval_status === "SUPERVISOR_APPROVED" ? "rgba(34, 197, 94, 0.2)" :
                                                          act.approval_status === "REJECTED" ? "rgba(239, 68, 68, 0.2)" : "rgba(100, 100, 100, 0.2)",
                                          color: act.approval_status === "PENDING" ? "#eab308" :
                                                 act.approval_status === "SUPERVISOR_APPROVED" ? "#22c55e" :
                                                 act.approval_status === "REJECTED" ? "#ef4444" : "#888",
                                        }}>
                                          {act.approval_status || "—"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ))}
                                {timesheetDays.length === 0 && (
                                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No logs found.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="ts-status-bar">
                          <div className="ts-status-info">
                            <div className="label-sm" style={{ marginBottom: 4 }}>TIMESHEET STATUS</div>
                            <div className="status-badge warn"><span className="dot" /> DRAFT</div>
                            {submitMsg && (
                              <div style={{ 
                                marginTop: 8, 
                                padding: "6px 10px", 
                                borderRadius: 6, 
                                fontSize: "0.85rem",
                                backgroundColor: submitMsg.type === "success" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                color: submitMsg.type === "success" ? "#22c55e" : "#ef4444",
                              }}>
                                {submitMsg.text}
                              </div>
                            )}
                          </div>
                          <button 
                            className="ts-submit-btn" 
                            onClick={submitTimesheet}
                            disabled={submitLoading}
                            style={{ opacity: submitLoading ? 0.6 : 1 }}
                          >
                            <span style={{ marginRight: 8 }}>{submitLoading ? "⏳" : "📤"}</span>
                            {submitLoading ? "Submitting..." : "Submit for Review"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'calendar' && (
                    <div className="glass-card" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", padding: 25 }}>
                      <div className="calendar-header-bar">
                        <div className="cal-controls">
                          <button className="cal-nav-btn" onClick={() => calNavigate(-1)}>❮</button>
                          <span style={{ minWidth: 180, textAlign: "center", fontFamily: "var(--font-main)", fontWeight: 700, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: 1 }}>
                            {getCalendarTitle()}
                          </span>
                          <button className="cal-nav-btn" onClick={() => calNavigate(1)}>❯</button>
                        </div>

                        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
                          <button className="calendar-add-btn" onClick={() => openFutureModal()}>
                            + Add Future Activity
                          </button>
                          <div className="cal-toggles">
                            <button className={`cal-view-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => setCalView('week')}>Week</button>
                            <button className={`cal-view-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => setCalView('month')}>Month</button>
                          </div>
                        </div>
                      </div>

                      <div className={`calendar-grid view-${calView}`}>
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                          <div key={d} className="cal-day-header">{d}</div>
                        ))}

                        {(() => {
                          const days = [];
                          const currMonth = calDate.getMonth();
                          const start = new Date(calDate);
                          let loopCount = 0;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);

                          if (calView === 'week') {
                            const day = start.getDay();
                            start.setDate(start.getDate() - day);
                            loopCount = 7;
                          } else {
                            start.setDate(1);
                            start.setDate(start.getDate() - start.getDay());
                            loopCount = 42;
                          }

                          const runner = new Date(start);

                          for (let i = 0; i < loopCount; i++) {
                            const dateNum = runner.getDate();
                            const isToday = runner.toDateString() === new Date().toDateString();
                            const isDiffMonth = runner.getMonth() !== currMonth && calView === 'month';

                            const year = runner.getFullYear();
                            const monthStr = String(runner.getMonth() + 1).padStart(2, "0");
                            const dayStr = String(dateNum).padStart(2, "0");
                            const dateKey = `${year}-${monthStr}-${dayStr}`;

                            const dayData = calendar[dateKey];
                            const dayFutureActivities = futureSchedules[dateKey] || [];
                            const cellDate = new Date(runner);
                            cellDate.setHours(0, 0, 0, 0);
                            const isFutureDate = cellDate >= today;
                            const hasShift = dayData && !dayData.off;
                            const canAddActivity = isFutureDate && hasShift && !isDiffMonth;

                            days.push(
                              <div
                                key={i}
                                className={`cal-day ${isDiffMonth ? 'diff-month' : ''} ${hasShift ? 'is-scheduled' : ''} ${isToday ? 'today' : ''} ${dayFutureActivities.length > 0 ? 'has-future-activity' : ''}`}
                                onClick={() => canAddActivity && openFutureModal(dateKey)}
                                style={{ cursor: canAddActivity ? 'pointer' : 'default' }}
                              >
                                <div className="cal-date-num">{dateNum}</div>

                                {!isDiffMonth && dayData && (
                                  dayData.off ? (
                                    <div className="cal-chip" style={{ opacity: 0.5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                      Off
                                    </div>
                                  ) : (
                                    <>
                                      <div className="cal-chip chip-shift">
                                        {dayData.shift_name}
                                      </div>
                                      {calView === 'week' ? (
                                        <>
                                          <div className="cal-chip" style={{ background: 'rgba(0, 242, 255, 0.1)', color: 'var(--accent-cyan)' }}>
                                            {formatShiftTime(dayData.start_time)} - {formatShiftTime(dayData.end_time)}
                                          </div>
                                          {dayData.activity && (
                                            <div className="cal-chip" style={{ background: 'rgba(15, 52, 166, 0.2)', color: 'var(--accent-blue)' }}>
                                              {dayData.activity}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="cal-chip" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                          {formatShiftTime(dayData.start_time)}
                                        </div>
                                      )}
                                    </>
                                  )
                                )}

                                {/* Future Activities */}
                                {!isDiffMonth && dayFutureActivities.length > 0 && (
                                  <div className="future-activities-list">
                                    {dayFutureActivities.map((fs: any) => (
                                      <div 
                                        key={fs.fts_id} 
                                        className="future-activity-item"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="future-activity-name">{fs.activity_name}</span>
                                        <span className="future-activity-time">{fs.start_time}-{fs.end_time}</span>
                                        <button 
                                          className="future-activity-delete" 
                                          onClick={(e) => { e.stopPropagation(); deleteFutureActivity(fs.fts_id); }}
                                          title="Delete"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                            runner.setDate(runner.getDate() + 1);
                          }
                          return days;
                        })()}
                      </div>

                      {/* Add Future Activity Modal */}
                      {showFutureModal && (
                        <div className="calendar-modal-overlay">
                          <div className="calendar-modal">
                            <div className="calendar-modal-header">
                              <h3>Add Future Activity</h3>
                              <button className="calendar-modal-close" onClick={closeFutureModal}>×</button>
                            </div>
                            <form onSubmit={submitFutureActivity} className="calendar-modal-form">
                              <div className="calendar-modal-field">
                                <label htmlFor="modal-date">Date</label>
                                <input
                                  type="date"
                                  id="modal-date"
                                  value={futureModalDate}
                                  onChange={(e) => handleFutureDateChange(e.target.value)}
                                  min={new Date().toISOString().split("T")[0]}
                                  required
                                />
                                {futureModalShiftTimes && (
                                  <span className="shift-time-hint">
                                    Shift: {futureModalShiftTimes.start} - {futureModalShiftTimes.end}
                                  </span>
                                )}
                              </div>

                              <div className="calendar-modal-field">
                                <label htmlFor="modal-activity">Activity</label>
                                <select
                                  id="modal-activity"
                                  value={futureModalActivity}
                                  onChange={(e) => setFutureModalActivity(e.target.value)}
                                  required
                                >
                                  <option value="">Select an activity</option>
                                  {activityList.map((act: any) => (
                                    <option key={act.activity_id} value={act.activity_id}>
                                      {act.activity_name} ({act.activity_code})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="calendar-modal-time-row">
                                <div className="calendar-modal-field">
                                  <label htmlFor="modal-start-time">Start Time</label>
                                  <input
                                    type="time"
                                    id="modal-start-time"
                                    value={futureModalStartTime}
                                    onChange={(e) => setFutureModalStartTime(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="calendar-modal-field">
                                  <label htmlFor="modal-end-time">End Time</label>
                                  <input
                                    type="time"
                                    id="modal-end-time"
                                    value={futureModalEndTime}
                                    onChange={(e) => setFutureModalEndTime(e.target.value)}
                                    required
                                  />
                                </div>
                              </div>

                              {futureModalError && <div className="calendar-modal-error">{futureModalError}</div>}

                              <div className="calendar-modal-actions">
                                <button type="button" className="calendar-modal-cancel" onClick={closeFutureModal}>
                                  Cancel
                                </button>
                                <button type="submit" className="calendar-modal-submit" disabled={futureModalSaving}>
                                  {futureModalSaving ? "Saving..." : "Save Activity"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeSection === 'analytics' && (
                    <div className="section-view fade-in">
                      {analyticsLoading ? (
                        <div className="analytics-loading">
                          <div className="spinner"></div>
                          <span style={{ fontSize: "0.9rem", letterSpacing: 1, opacity: 0.7 }}>FETCHING DATA...</span>
                        </div>
                      ) : (
                        <div className="analytics-content-enter" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
                          <div className="stats-row">
                            <div className="stat-box">
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                HOURS THIS WEEK
                              </div>
                              <div className="stat-big">
                                {analyticsData?.summary?.totalHours?.toFixed(1) || "0.0"} <span style={{ fontSize: "1rem", color: "var(--text-main)" }}>Hrs</span>
                              </div>
                            </div>
                            <div className="stat-box">
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                BILLABLE HOURS
                              </div>
                              <div className="stat-big" style={{ color: "var(--color-go)" }}>
                                {analyticsData?.summary?.billableHours?.toFixed(1) || "0.0"} <span style={{ fontSize: "1rem", color: "var(--text-main)" }}>Hrs</span>
                              </div>
                            </div>
                            <div className="stat-box" style={{ borderColor: "var(--accent-cyan)" }}>
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                WEEKLY ACTIVITY %
                              </div>
                              <div className="stat-big">
                                {(() => {
                                  const total = analyticsData?.summary?.totalHours || 0;
                                  // Assuming 40h work week target for % calculation
                                  const target = 40;
                                  const pct = total > 0 ? (total / target) * 100 : 0;
                                  return pct.toFixed(1);
                                })()} <span style={{ fontSize: "1rem", color: "var(--text-main)" }}>%</span>
                              </div>
                            </div>
                          </div>

                          <div className="glass-card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 25 }}>
                            <div className="section-title">
                              Hours Worked vs Target
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <button 
                                  className="cal-nav-btn" 
                                  onClick={() => setAnalyticsWeekOffset(prev => prev - 1)}
                                  style={{ padding: "6px 12px" }}
                                >
                                  ◀
                                </button>
                                <span style={{ minWidth: 140, textAlign: "center", fontSize: "0.85rem", fontWeight: 600 }}>
                                  {(() => {
                                    const today = new Date();
                                    const dayOfWeek = today.getDay();
                                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                    const monday = new Date(today);
                                    monday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));
                                    const sunday = new Date(monday);
                                    sunday.setDate(monday.getDate() + 6);
                                    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return `${fmt(monday)} - ${fmt(sunday)}`;
                                  })()}
                                </span>
                                <button 
                                  className="cal-nav-btn" 
                                  onClick={() => setAnalyticsWeekOffset(prev => Math.min(prev + 1, 0))}
                                  disabled={analyticsWeekOffset >= 0}
                                  style={{ padding: "6px 12px", opacity: analyticsWeekOffset >= 0 ? 0.4 : 1 }}
                                >
                                  ▶
                                </button>
                                {analyticsWeekOffset !== 0 && (
                                  <button 
                                    onClick={() => setAnalyticsWeekOffset(0)}
                                    style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 4, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
                                  >
                                    Today
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="graph-container">
                              {(() => {
                                // Generate chart for selected week (Mon-Sun)
                                const days = [];
                                const today = new Date();
                                const TARGET_HOURS = 9;
                                const MAX_SCALE = 12;

                                // Calculate Monday of selected week
                                const currentDay = today.getDay(); // 0 is Sunday
                                const diff = currentDay === 0 ? 6 : currentDay - 1; // adjust when day is sunday
                                const monday = new Date(today);
                                monday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));

                                for (let i = 0; i < 7; i++) {
                                  const d = new Date(monday);
                                  d.setDate(monday.getDate() + i);
                                  const dateKey = d.toISOString().split('T')[0];
                                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                                  const hours = analyticsData?.dailyHours?.[dateKey] || 0;

                                  // Calculate height
                                  const actualHeight = Math.min((hours / MAX_SCALE) * 100, 100);
                                  const targetHeight = (TARGET_HOURS / MAX_SCALE) * 100;

                                  // Determine color
                                  let barColor = "var(--bg-card)";
                                  if (hours > 0) {
                                    if (hours > TARGET_HOURS) barColor = "var(--accent-cyan)";
                                    else if (hours >= TARGET_HOURS - 0.5) barColor = "var(--color-go)";
                                    else if (hours > 5) barColor = "var(--color-warn)";
                                    else barColor = "var(--color-urgent)";
                                  }

                                  days.push(
                                    <div key={dateKey} className="bar-group">
                                      {/* Target Marker moved to background to avoid z-index overlap issues if needed, but keeping absolute as per design */}
                                      <div className="bar-target" style={{ height: `${targetHeight}%` }} />

                                      <div className="bar" style={{ height: `${actualHeight}%`, background: barColor, zIndex: 2, opacity: 0.9 }} />

                                      <div className="bar-label">{dayName}</div>

                                      {hours > 0 && (
                                        <div style={{ position: "absolute", bottom: `${actualHeight + 2}%`, color: "var(--text-main)", fontSize: "0.7rem", fontWeight: 700, zIndex: 3 }}>
                                          {hours.toFixed(1)}h
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return days;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
                {/* end section-animate */}
              </div>
            )}
          </div>
        </main >
      </div >

      {/* MODALS */}
      {
        modalConfirm === "out" && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-normal">
                <span style={{ fontSize: "1.5rem" }}>🕒</span>
                <span className="modal-title">CONFIRM CLOCK OUT</span>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Are you sure you want to end your shift?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setModalConfirm(null)}>CANCEL</button>
                <button className="btn-standard" onClick={confirmClockOutFlow}>CLOCK OUT</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showEarlyModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-urgent">
                <span style={{ fontSize: "1.5rem" }}>⚠️</span>
                <span className="modal-title" style={{ color: "var(--color-urgent)" }}>COMPLIANCE ALERT</span>
              </div>

              <div className="modal-body">
                <p className="modal-desc">
                  You are attempting to clock out before meeting the daily 9-hour requirement. This action will be logged.
                </p>

                <div className="modal-stats">
                  <div className="stat-item">
                    <span className="stat-label">CURRENT SESSION</span>
                    <span className="stat-val val-urgent">{sessionDuration}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">TARGET DURATION</span>
                    <span className="stat-val">09:00:00</span>
                  </div>
                </div>

                <div>
                  <label className="label-sm" style={{ color: "var(--color-urgent)", marginBottom: 8, display: "block" }}>
                    COMPLIANCE JUSTIFICATION LOG
                  </label>
                  <input
                    className={`input-rounded ${reasonShake ? "shake" : ""}`}
                    placeholder="Enter reason for early log out..."
                    value={reason}
                    onChange={onReasonChange}
                    onPaste={onReasonPaste}
                    onBeforeInput={(e: any) => onReasonBeforeInput(e)}
                    style={{ borderColor: "var(--color-urgent)", background: "rgba(248, 49, 47, 0.05)" }}
                  />
                  {reasonErr && <div style={{ color: "var(--color-urgent)", marginTop: 5, fontSize: "0.8rem" }}>{reasonErr}</div>}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowEarlyModal(false)}>CANCEL</button>
                <button className="btn-urgent" onClick={submitEarlyReason}>CONFIRM EARLY EXIT</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showLogoutPrompt && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-normal">
                <span style={{ fontSize: "1.5rem" }}>👋</span>
                <span className="modal-title">SHIFT ENDED</span>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Do you want to log out now?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowLogoutPrompt(false)}>
                  STAY HERE
                </button>
                <button className="btn-standard" onClick={() => void doLogout()}>
                  LOG OUT
                </button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}