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
  start_time_str?: string; 
};

type ActivityTrackerProps = {
  isClockedIn: boolean;
  onActivityChange?: () => void;
  onActivityTimeChange?: (startTime: number | null) => void;
};

export default function ActivityTracker({ isClockedIn, onActivityChange, onActivityTimeChange }: ActivityTrackerProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<CurrentActivity | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activityStartTime, setActivityStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (onActivityTimeChange) {
      onActivityTimeChange(activityStartTime);
    }
  }, [activityStartTime, onActivityTimeChange]);

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

  const loadCurrentActivity = useCallback(async () => {
    if (!isClockedIn) {
      setCurrentActivity(null);
      setActivityStartTime(null);
      return;
    }

    try {
      const ts = Date.now(); 
      const res = await fetch(`/api/employee/activity/current?t=${ts}`, { 
        cache: "no-store",
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveActivity && data.currentActivity) {
          setCurrentActivity(data.currentActivity);
          setSelectedActivityId(data.currentActivity.activity_id.toString());

          if (data.currentActivity.start_time_str) {
            const [hours, minutes, seconds] = data.currentActivity.start_time_str.split(':').map(Number);
            
            const now = new Date();
            const candidate = new Date(now);
            candidate.setHours(hours, minutes, seconds, 0);

            if (candidate.getTime() - now.getTime() > 2 * 60 * 60 * 1000) {
              candidate.setDate(candidate.getDate() - 1);
            }

            setActivityStartTime(candidate.getTime());
          }
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
    if (!selectedActivityId) return setMessage("Please select an activity");
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/employee/activity/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: selectedActivityId }),
      });

      if (res.ok) {
        setMessage("Activity started successfully");
        setActivityStartTime(Date.now()); 
        await loadCurrentActivity(); 
        onActivityChange?.();
      } else {
        const data = await res.json();
        setMessage(data.message || "Failed to start activity");
      }
    } catch (error) {
      setMessage("Failed to start activity");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchActivity = async () => {
    if (!selectedActivityId) return setMessage("Please select an activity");
    if (currentActivity && selectedActivityId === currentActivity.activity_id.toString()) {
      return setMessage("This activity is already active");
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/employee/activity/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: selectedActivityId }),
      });

      if (res.ok) {
        setMessage("Activity switched successfully");
        setActivityStartTime(Date.now()); 
        await loadCurrentActivity(); 
        onActivityChange?.(); 
      } else {
        const data = await res.json();
        setMessage(data.message || "Failed to switch activity");
      }
    } catch (error) {
      setMessage("Failed to switch activity");
    } finally {
      setLoading(false);
    }
  };

  if (!isClockedIn) return null;

  useEffect(() => {
    if (currentActivity && !selectedActivityId) {
      setSelectedActivityId(currentActivity.activity_id.toString());
    }
  }, [currentActivity, selectedActivityId]);

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
            {/* ✅ Added the Billable/Non-Billable flag here! */}
            {activity.activity_name} {activity.activity_code && `(${activity.activity_code})`} {activity.is_billable ? '(B)' : '(NB)'}
          </option>
        ))}
      </select>

      <button
        className="btn-ap-primary"
        onClick={() => !currentActivity ? handleStartActivity() : handleSwitchActivity()}
        disabled={loading || !selectedActivityId}
      >
        {loading ? "PROCESSING..." : currentActivity ? "LOG CHANGE & UPDATE TIMER" : "START ACTIVITY"}
      </button>

      {message && (
        <div className={message.includes('success') ? 'inline-success' : 'inline-warn'}>
          {message}
        </div>
      )}
    </div>
  );
}