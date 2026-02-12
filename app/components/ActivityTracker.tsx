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

// Convert UTC time string (HH:MM:SS) to local time display
function formatUTCTimeToLocal(utcTimeStr: string, logDate: Date | string): string {
  try {
    // Parse the log_date and UTC time
    const date = new Date(logDate);
    const [hours, minutes, seconds] = utcTimeStr.split(':').map(Number);
    
    // Create a UTC date object
    const utcDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      seconds || 0
    ));
    
    // Format in local time
    return utcDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return utcTimeStr;
  }
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
          
          // Calculate start time timestamp - API returns UTC time
          const startDate = new Date(data.currentActivity.log_date);
          const startTimeStr = data.currentActivity.start_time;
          const [hours, minutes, seconds] = startTimeStr.split(':').map(Number);
          
          // Create UTC date since start_time from API is in UTC
          const utcStartTime = Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            hours,
            minutes,
            seconds || 0
          );
          setActivityStartTime(utcStartTime);
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

  return (
    <div className="activity-tracker">
      <div className="panel-header">
        <div className="panel-title">ACTIVITY TRACKER</div>
        {currentActivity && (
          <div className="panel-right" style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            {activityDuration}
          </div>
        )}
      </div>

      <div className="panel-body" style={{ padding: '1.5rem' }}>
        {currentActivity ? (
          <div className="current-activity-box" style={{ 
            padding: '1rem', 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div className="label-sm" style={{ marginBottom: '0.5rem', opacity: 0.7 }}>
              CURRENT ACTIVITY
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              {currentActivity.activity_name}
              {currentActivity.activity_code && (
                <span style={{ opacity: 0.7, marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                  ({currentActivity.activity_code})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              {currentActivity.is_billable ? '💰 Billable' : '📝 Non-billable'} · 
              Started at {formatUTCTimeToLocal(currentActivity.start_time, currentActivity.log_date)} · 
              Duration: {activityDuration}
            </div>
          </div>
        ) : (
          <div className="label-sm" style={{ marginBottom: '1rem', opacity: 0.7 }}>
            No active activity. Start tracking your work below.
          </div>
        )}

        <div className="label-sm" style={{ marginBottom: '0.5rem' }}>
          {currentActivity ? 'Switch to a different activity:' : 'Select an activity to start:'}
        </div>

        <select 
          className="select" 
          value={selectedActivityId}
          onChange={(e) => setSelectedActivityId(e.target.value)}
          disabled={loading}
          style={{ marginBottom: '1rem' }}
        >
          <option value="">-- Select Activity --</option>
          {activities.map((activity) => (
            <option key={activity.activity_id} value={activity.activity_id}>
              {activity.activity_name} {activity.activity_code && `(${activity.activity_code})`}
              {activity.is_billable ? ' - Billable' : ' - Non-billable'}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {currentActivity ? (
            <>
              <button
                className="primary-btn"
                onClick={handleSwitchActivity}
                disabled={loading || !selectedActivityId}
                style={{ flex: 1 }}
              >
                {loading ? 'SWITCHING...' : 'SWITCH ACTIVITY'}
              </button>
              <button
                className="danger-btn"
                onClick={handleEndActivity}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'ENDING...' : 'END ACTIVITY'}
              </button>
            </>
          ) : (
            <button
              className="primary-btn"
              onClick={handleStartActivity}
              disabled={loading || !selectedActivityId}
              style={{ width: '100%' }}
            >
              {loading ? 'STARTING...' : 'START ACTIVITY'}
            </button>
          )}
        </div>

        {message && (
          <div className={message.includes('success') ? 'inline-success' : 'inline-warn'} style={{ marginTop: '1rem' }}>
            {message}
          </div>
        )}
      </div>

      <style jsx>{`
        .inline-success {
          padding: 0.75rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 4px;
          color: #22c55e;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
