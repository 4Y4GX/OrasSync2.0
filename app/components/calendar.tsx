"use client";

import { useState, useEffect, useCallback } from "react";

type Activity = {
  activity_id: number;
  activity_code: string | null;
  activity_name: string | null;
  is_billable: boolean | null;
};

type FutureSchedule = {
  fts_id: number;
  user_id: string;
  activity_id: number;
  activity_name: string | null;
  activity_code: string | null;
  is_billable: boolean | null;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
};

export default function Calendar({ userId }: { userId: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendar, setCalendar] = useState<Record<string, any>>({});
  const [futureSchedules, setFutureSchedules] = useState<Record<string, FutureSchedule[]>>({});
  const [loading, setLoading] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [modalError, setModalError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [shiftTimes, setShiftTimes] = useState<{ start: string; end: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Load calendar data
  const loadCalendar = useCallback(async () => {
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
  }, [userId, year, month]);

  // Load future schedules
  const loadFutureSchedules = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(
        `/api/employee/schedule/future?userId=${encodeURIComponent(userId)}&year=${year}&month=${month}`
      );
      
      if (!response.ok) return;

      const data = await response.json();
      const map: Record<string, FutureSchedule[]> = {};
      if (data.schedules && Array.isArray(data.schedules)) {
        data.schedules.forEach((schedule: FutureSchedule) => {
          const dateKey = schedule.shift_date;
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(schedule);
        });
      }
      setFutureSchedules(map);
    } catch (err) {
      console.error("Fetch future schedules error:", err);
    }
  }, [userId, year, month]);

  // Load activities for the modal
  const loadActivities = useCallback(async () => {
    try {
      const response = await fetch("/api/employee/activity/list");
      if (!response.ok) return;
      const data = await response.json();
      if (data.activities) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error("Fetch activities error:", err);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
    loadFutureSchedules();
  }, [loadCalendar, loadFutureSchedules]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Update shift times when date changes
  useEffect(() => {
    if (selectedDate && calendar[selectedDate]) {
      const dayData = calendar[selectedDate];
      if (!dayData.off && dayData.start_time && dayData.end_time) {
        setShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        // Pre-fill with shift times
        if (!startTime) setStartTime(dayData.start_time);
        if (!endTime) setEndTime(dayData.end_time);
      } else {
        setShiftTimes(null);
      }
    }
  }, [selectedDate, calendar]);

  const openModal = (dateKey?: string) => {
    setModalError("");
    setSelectedActivity("");
    setStartTime("");
    setEndTime("");
    
    if (dateKey) {
      setSelectedDate(dateKey);
      const dayData = calendar[dateKey];
      if (dayData && !dayData.off) {
        setShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setStartTime(dayData.start_time);
        setEndTime(dayData.end_time);
      }
    } else {
      setSelectedDate("");
      setShiftTimes(null);
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalError("");
    setSelectedDate("");
    setSelectedActivity("");
    setStartTime("");
    setEndTime("");
    setShiftTimes(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setModalError("");
    
    // Check if this date has a shift
    if (calendar[newDate]) {
      const dayData = calendar[newDate];
      if (!dayData.off && dayData.start_time && dayData.end_time) {
        setShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setStartTime(dayData.start_time);
        setEndTime(dayData.end_time);
      } else {
        setShiftTimes(null);
        setStartTime("");
        setEndTime("");
        setModalError("No shift scheduled for this day");
      }
    } else {
      setShiftTimes(null);
      setStartTime("");
      setEndTime("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!selectedDate || !selectedActivity || !startTime || !endTime) {
      setModalError("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/employee/schedule/future", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: selectedActivity,
          shift_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setModalError(data.message || "Failed to save activity");
        return;
      }

      // Refresh future schedules
      await loadFutureSchedules();
      closeModal();
    } catch (err) {
      setModalError("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ftsId: number) => {
    if (!confirm("Are you sure you want to delete this scheduled activity?")) return;
    
    try {
      const response = await fetch(`/api/employee/schedule/future?fts_id=${ftsId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadFutureSchedules();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get min date for date picker (today)
  const minDate = today.toISOString().split("T")[0];

  return (
    <div className="glass-card">
      <div className="calendar-header-bar">
        <button className="cal-nav-btn" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>◀</button>
        <h3>{currentDate.toLocaleString("default", { month: "long", year: "numeric" })}</h3>
        <button className="cal-nav-btn" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>▶</button>
      </div>

      <div className="calendar-add-btn-container">
        <button className="calendar-add-btn" onClick={() => openModal()}>
          + Add Future Activity
        </button>
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
          const dayFutureSchedules = futureSchedules[key] || [];
          const cellDate = new Date(year, month, day);
          const isFutureDate = cellDate >= today;
          const hasShift = data?.off === false;

          return (
            <div 
              key={day} 
              className={`cal-day ${hasShift ? "has-shift" : ""} ${dayFutureSchedules.length > 0 ? "has-future-activity" : ""}`}
              onClick={() => isFutureDate && hasShift && openModal(key)}
              style={{ cursor: isFutureDate && hasShift ? "pointer" : "default" }}
            >
              <div className="cal-date-num">{day}</div>
              {data && !data.off && (
                <div className="shift-info">
                  <div style={{ fontWeight: "bold" }}>{data.shift_name}</div>
                  <div style={{ fontSize: "0.75rem" }}>{data.start_time}-{data.end_time}</div>
                </div>
              )}
              {dayFutureSchedules.length > 0 && (
                <div className="future-activities-list">
                  {dayFutureSchedules.map((fs) => (
                    <div 
                      key={fs.fts_id} 
                      className="future-activity-item"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="future-activity-name">{fs.activity_name}</span>
                      <span className="future-activity-time">{fs.start_time}-{fs.end_time}</span>
                      <button 
                        className="future-activity-delete" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(fs.fts_id); }}
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
        })}
      </div>

      {/* Add Future Activity Modal */}
      {showModal && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>Add Future Activity</h3>
              <button className="calendar-modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="calendar-modal-form">
              <div className="calendar-modal-field">
                <label htmlFor="modal-date">Date</label>
                <input
                  type="date"
                  id="modal-date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={minDate}
                  required
                />
                {shiftTimes && (
                  <span className="shift-time-hint">
                    Shift: {shiftTimes.start} - {shiftTimes.end}
                  </span>
                )}
              </div>

              <div className="calendar-modal-field">
                <label htmlFor="modal-activity">Activity</label>
                <select
                  id="modal-activity"
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                  required
                >
                  <option value="">Select an activity</option>
                  {activities.map((act) => (
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
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="calendar-modal-field">
                  <label htmlFor="modal-end-time">End Time</label>
                  <input
                    type="time"
                    id="modal-end-time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {modalError && <div className="calendar-modal-error">{modalError}</div>}

              <div className="calendar-modal-actions">
                <button type="button" className="calendar-modal-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="calendar-modal-submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}