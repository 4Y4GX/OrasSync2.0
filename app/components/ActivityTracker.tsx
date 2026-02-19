"use client";

import { useEffect, useState, useCallback } from "react";

type Activity = {
  activity_id: number;
  activity_code: string | null;
  activity_name: string | null;
  is_billable: boolean | null;
};

type CurrentActivity = {
  tlog_id: number;
  activity_id: number;
  activity_name: string | null;
  activity_code: string | null;
  is_billable: boolean | null;
  start_time: string;
  log_date: Date;
};

type ActivityTrackerProps = {
  isClockedIn: boolean;
  onActivityChange?: () => void;
};

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

export default function ActivityTracker({ isClockedIn, onActivityChange }: ActivityTrackerProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<CurrentActivity | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(new Date());
  const [activityStartTime, setActivityStartTime] = useState<number | null>(null);

  // Tick clock for duration display
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Load activities list
  useEffect(() => {
    if (!isClockedIn) return;

    (async () => {
      try {
        const res = await fetch("/api/employee/activity/list");
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error("Failed to load activities:", error);
      }
    })();
  }, [isClockedIn]);

  // Load current activity
  const loadCurrentActivity = useCallback(async () => {
    if (!isClockedIn) {
      setCurrentActivity(null);
      setActivityStartTime(null);
      return;
    }

    try {
      const res = await fetch("/api/employee/activity/current");
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveActivity && data.currentActivity) {
          setCurrentActivity(data.currentActivity);
          setSelectedActivityId(data.currentActivity.activity_id.toString());

          // Calculate start time timestamp
          const startDate = new Date(data.currentActivity.log_date);
          const startTimeStr = data.currentActivity.start_time;
          const [hours, minutes, seconds] = startTimeStr.split(':');
          startDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || '0'));
          setActivityStartTime(startDate.getTime());
        } else {
          setCurrentActivity(null);
          setActivityStartTime(null);
        }
      }
    } catch (error) {
      console.error("Failed to load current activity:", error);
    }
  }, [isClockedIn]);

  useEffect(() => {
    loadCurrentActivity();
  }, [loadCurrentActivity]);

  const handleStartActivity = async () => {
    if (!selectedActivityId) {
      setMessage("Please select an activity");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/employee/activity/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: selectedActivityId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Activity started successfully");
        await loadCurrentActivity();
        onActivityChange?.();
      } else {
        setMessage(data.message || "Failed to start activity");
      }
    } catch (error) {
      setMessage("Failed to start activity");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchActivity = async () => {
    if (!selectedActivityId) {
      setMessage("Please select an activity");
      return;
    }

    if (currentActivity && selectedActivityId === currentActivity.activity_id.toString()) {
      setMessage("This activity is already active");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/employee/activity/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: selectedActivityId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Activity switched successfully");
        await loadCurrentActivity();
        onActivityChange?.();
      } else {
        setMessage(data.message || "Failed to switch activity");
      }
    } catch (error) {
      setMessage("Failed to switch activity");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndActivity = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/employee/activity/end", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Activity ended successfully");
        await loadCurrentActivity();
        onActivityChange?.();
      } else {
        setMessage(data.message || "Failed to end activity");
      }
    } catch (error) {
      setMessage("Failed to end activity");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const activityDuration = activityStartTime && currentActivity
    ? formatDuration(now.getTime() - activityStartTime)
    : "00:00:00";

  if (!isClockedIn) {
    return null;
  }

  if (!isClockedIn) {
    return null;
  }

  // Pre-select current activity in dropdown if available
  useEffect(() => {
    if (currentActivity && !selectedActivityId) {
      setSelectedActivityId(currentActivity.activity_id.toString());
    }
  }, [currentActivity, selectedActivityId]);

  const handleAction = () => {
    if (!currentActivity) {
      handleStartActivity();
    } else {
      handleSwitchActivity();
    }
  };

  const btnText = loading
    ? "PROCESSING..."
    : currentActivity
      ? "LOG CHANGE & UPDATE TIMER"
      : "START ACTIVITY";

  return (
    <div className="ap-container">
      <select
        className="ap-dropdown"
        value={selectedActivityId}
        onChange={(e) => setSelectedActivityId(e.target.value)}
        disabled={loading}
      >
        <option value="">-- Select Activity --</option>
        {activities.map((activity) => (
          <option key={activity.activity_id} value={activity.activity_id}>
            {activity.activity_name} {activity.activity_code && `(${activity.activity_code})`}
          </option>
        ))}
      </select>

      <button
        className="btn-ap-primary"
        onClick={handleAction}
        disabled={loading || !selectedActivityId}
      >
        {btnText}
      </button>

      {message && (
        <div className={message.includes('success') ? 'inline-success' : 'inline-warn'}>
          {message}
        </div>
      )}
    </div>
  );
}
