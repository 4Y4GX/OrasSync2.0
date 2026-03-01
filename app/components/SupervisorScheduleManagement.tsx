"use client";

import { useState, useEffect } from "react";

type TeamMember = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  D_tbldepartment: { dept_name: string } | null;
  D_tblteam: { team_name: string } | null;
  D_tblweekly_schedule: Array<{
    schedule_id: number;
    monday_shift_id: number | null;
    tuesday_shift_id: number | null;
    wednesday_shift_id: number | null;
    thursday_shift_id: number | null;
    friday_shift_id: number | null;
    saturday_shift_id: number | null;
    sunday_shift_id: number | null;
    D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
  }>;
};

type Shift = {
  shift_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  description: string | null;
};

type FutureActivity = {
  fts_id: number;
  user_id: string;
  employee_name: string;
  activity_id: number;
  activity_name: string;
  activity_code: string;
  is_billable: boolean;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
  activity_type?: string;
};

export default function SupervisorScheduleManagement() {
  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [editShiftModal, setEditShiftModal] = useState({
    show: false, empId: "", empName: "", day: "", currentShift: "", newShiftId: "", scheduleId: null as number | null
  });
  const [saveShiftConfirmModal, setSaveShiftConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [futureActivities, setFutureActivities] = useState<FutureActivity[]>([]);
  const [futureLoading, setFutureLoading] = useState(true);

  const [activityFormData, setActivityFormData] = useState({
    employee_id: '',
    activity_date: '',
    activity_type: 'MEETING',
    start_time: '',
    end_time: '',
    notes: ''
  });

  // --- Assign Schedule ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    days: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false } as Record<string, boolean>,
  });
  const [assignConfirmModal, setAssignConfirmModal] = useState<{ show: boolean; hasConflicts: boolean; conflictDays: string[] }>({
    show: false, hasConflicts: false, conflictDays: [],
  });
  const [assignResultModal, setAssignResultModal] = useState<{ show: boolean; success: boolean; message: string }>({
    show: false, success: false, message: '',
  });
  const [assignSaving, setAssignSaving] = useState(false);

  const fetchScheduleData = async () => {
    setSchedLoading(true);
    try {
      const res = await fetch('/api/supervisor/schedules/list');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.teamMembers || []);

        const formatTime = (dateObj: Date | string | null) => {
          if (!dateObj) return null;
          return new Date(dateObj).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        };

        const formattedSchedule = (data.teamMembers || []).map((emp: any) => {
          const sched = emp.D_tblweekly_schedule[0];

          const getShiftData = (shiftRef: any) => {
            if (!shiftRef) return null;
            return {
              shift_name: shiftRef.shift_name,
              time: `${formatTime(shiftRef.start_time)} - ${formatTime(shiftRef.end_time)}`
            };
          };

          return {
            user_id: emp.user_id,
            name: `${emp.first_name} ${emp.last_name}`,
            schedule_id: sched?.schedule_id || null,
            schedule: {
              monday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template),
              tuesday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template),
              wednesday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template),
              thursday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template),
              friday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template),
              saturday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template),
              sunday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template),
            }
          };
        });

        setScheduleData(formattedSchedule);
      }

      const templateRes = await fetch('/api/supervisor/shifts/list');
      if (templateRes.ok) {
        const templates = await templateRes.json();
        setShiftTemplates(templates.shifts || []);
      }
    } catch (e) {
      console.error(e);
      setMessage("Failed to load schedule grid.");
    }
    finally { setSchedLoading(false); }
  };

  const loadFutureActivities = async () => {
    setFutureLoading(true);
    try {
      const res = await fetch("/api/supervisor/future-schedule/list");
      if (res.ok) {
        const data = await res.json();
        setFutureActivities(data.schedules || []);
      } else {
        setFutureActivities([]);
      }
    } catch (error) {
      console.error("Failed to load future activities:", error);
      setFutureActivities([]);
    } finally {
      setFutureLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
    loadFutureActivities();
  }, [calendarView, currentDate]);

  const executeSaveShiftEdit = async () => {
    if (!editShiftModal.scheduleId) {
      alert("This employee does not have an active weekly schedule to edit yet.");
      setSaveShiftConfirmModal(false);
      return;
    }

    setIsSaving(true);
    try {
      const dayKeyMap: Record<string, string> = {
        'Mon': 'monday_shift_id',
        'Tue': 'tuesday_shift_id',
        'Wed': 'wednesday_shift_id',
        'Thu': 'thursday_shift_id',
        'Fri': 'friday_shift_id',
        'Sat': 'saturday_shift_id',
        'Sun': 'sunday_shift_id'
      };
      const dbColumn = dayKeyMap[editShiftModal.day];

      const payload = {
        schedule_id: editShiftModal.scheduleId,
        [dbColumn]: editShiftModal.newShiftId === 'OFF' ? null : Number(editShiftModal.newShiftId)
      };

      const res = await fetch('/api/supervisor/schedules/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveShiftConfirmModal(false);
        setEditShiftModal({ ...editShiftModal, show: false });
        setMessage("Shift updated successfully.");
        setTimeout(() => setMessage(''), 3000);
        fetchScheduleData();
      }
      else {
        const data = await res.json();
        alert(`Failed: ${data.message}`);
      }
    } catch (e) { alert("Connection error."); } finally { setIsSaving(false); }
  };

  const handleSaveActivity = async () => {
    if (!activityFormData.employee_id || !activityFormData.activity_date || !activityFormData.start_time || !activityFormData.end_time || !activityFormData.notes.trim()) {
      alert('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const activityMap: Record<string, number> = {
        'MEETING': 1, 'TRAINING': 2, 'LEAVE': 3, 'OFF_SITE': 4, 'PROJECT': 5, 'OTHER': 6
      };

      const res = await fetch('/api/supervisor/future-schedule/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activityFormData.employee_id,
          shift_date: activityFormData.activity_date,
          start_time: activityFormData.start_time,
          end_time: activityFormData.end_time,
          activity_id: activityMap[activityFormData.activity_type] || 1,
          notes: activityFormData.notes
        })
      });

      if (res.ok) {
        setMessage("Future activity added successfully!");
        setTimeout(() => setMessage(''), 3000);
        setShowActivityModal(false);
        setActivityFormData({ employee_id: '', activity_date: '', activity_type: 'MEETING', start_time: '', end_time: '', notes: '' });
        loadFutureActivities();
      }
      else { alert("Failed to add activity."); }
    } catch (e) { alert("Connection error."); } finally { setIsSaving(false); }
  };

  const handleDeleteActivity = async (fts_id: number) => {
    try {
      const res = await fetch('/api/supervisor/future-schedule/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fts_id })
      });

      if (res.ok) {
        setFutureActivities(futureActivities.filter(a => a.fts_id !== fts_id));
        setMessage('Activity removed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {message && (
        <div style={{
          padding: "1rem",
          background: message.includes("success") || message.includes("added") || message.includes("removed") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${message.includes("success") || message.includes("added") || message.includes("removed") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          borderRadius: "8px",
          color: message.includes("success") || message.includes("added") || message.includes("removed") ? "#22c55e" : "#ef4444",
        }}>
          {message}
        </div>
      )}

      {/* Future Activities Panel */}
      <div className="glass-card">
        <div className="section-title">
          <span>📅 Future Activities</span>
        </div>

        {futureLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading activities...</div>
        ) : futureActivities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No future activities scheduled.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {futureActivities.map((activity) => (
              <div key={activity.fts_id} className="activity-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{activity.employee_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{activity.shift_date}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteActivity(activity.fts_id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                    title="Remove activity"
                  >
                    ✕
                  </button>
                </div>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(167, 139, 250, 0.1)',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{activity.activity_name || activity.activity_type || `Activity #${activity.activity_id}`}</span>
                  {activity.is_billable && <span style={{ color: '#22c55e' }}>💰</span>}
                </div>
                {activity.start_time && activity.end_time && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>🕐 {activity.start_time} - {activity.end_time}</span>
                  </div>
                )}
                {activity.notes && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>{activity.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Schedule Panel */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ marginRight: '10px' }}>Team Schedule</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>
              {calendarView === 'weekly' ? (() => { const d = new Date(currentDate); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); const mf = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short' }); return mon.getMonth() === sun.getMonth() ? `${mf(mon)} ${mon.getDate()}-${sun.getDate()}` : `${mf(mon)} ${mon.getDate()}-${mf(sun)} ${sun.getDate()}`; })() : `Month of ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button
              onClick={() => { setAssignForm({ employee_id: '', shift_id: '', days: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false } }); setShowAssignModal(true); }}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--accent-primary)', background: 'rgba(167, 139, 250, 0.1)', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            >+ Assign Schedule</button>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setCalendarView('weekly')} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', background: calendarView === 'weekly' ? 'var(--accent-primary)' : 'transparent', color: calendarView === 'weekly' ? '#fff' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>Weekly</button>
              <button onClick={() => setCalendarView('monthly')} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', background: calendarView === 'monthly' ? 'var(--accent-primary)' : 'transparent', color: calendarView === 'monthly' ? '#fff' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>Monthly</button>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() - 7) : newDate.setMonth(newDate.getMonth() - 1); setCurrentDate(newDate); }}>← Prev</button>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setCurrentDate(new Date())}>Today</button>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() + 7) : newDate.setMonth(newDate.getMonth() + 1); setCurrentDate(newDate); }}>Next →</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: '600px' }}>
          {calendarView === 'weekly' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', height: '100%' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const dayKeyMap: Record<string, string> = { 'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday' };
                const dbDayKey = dayKeyMap[day];
                const shiftsForDay = scheduleData.filter(emp => emp.schedule && emp.schedule[dbDayKey] !== null);

                return (
                  <div key={day} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '15px', minHeight: '300px' }}>
                    <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '10px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-primary)' }}>{day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {schedLoading ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Loading...</div>
                      ) : shiftsForDay.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No shifts.</div>
                      ) : (
                        shiftsForDay.map(emp => (
                          <div
                            key={emp.user_id} className="glass-card"
                            style={{ padding: '10px', margin: 0, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'transparent'; }}
                            onClick={() => setEditShiftModal({
                              show: true,
                              empId: emp.user_id,
                              empName: emp.name,
                              day: day,
                              currentShift: emp.schedule[dbDayKey].shift_name,
                              newShiftId: "",
                              scheduleId: emp.schedule_id
                            })}
                          >
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{emp.name}</div>
                            <div style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginTop: '4px' }}>{emp.schedule[dbDayKey].shift_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{emp.schedule[dbDayKey].time}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            (() => {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const startOffset = (firstDay.getDay() + 6) % 7;
              const totalDays = lastDay.getDate();
              const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
              const today = new Date();
              const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

              const cells: { date: Date; inMonth: boolean; dayKey: string; dateStr: string }[] = [];
              for (let i = 0; i < totalCells; i++) {
                const diff = i - startOffset;
                const d = new Date(year, month, diff + 1);
                cells.push({ date: d, inMonth: diff >= 0 && diff < totalDays, dayKey: dayNameMap[d.getDay()], dateStr: d.toISOString().split('T')[0] });
              }

              const weeks: typeof cells[] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-primary)', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 0' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    {weeks.map((week, wi) => (
                      <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', flex: 1 }}>
                        {week.map((cell, ci) => {
                          const isToday = cell.inMonth && cell.date.toDateString() === today.toDateString();
                          const empCount = scheduleData.filter((emp: any) => emp.schedule && emp.schedule[cell.dayKey] !== null).length;
                          return (
                            <div
                              key={ci}
                              onClick={() => cell.inMonth && empCount > 0 && setExpandedDay(cell.dateStr)}
                              style={{
                                background: isToday ? 'rgba(167, 139, 250, 0.1)' : cell.inMonth ? 'var(--bg-input)' : 'rgba(0,0,0,0.15)',
                                border: isToday ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                borderRadius: '8px', padding: '10px',
                                cursor: cell.inMonth && empCount > 0 ? 'pointer' : 'default',
                                opacity: cell.inMonth ? 1 : 0.35, transition: 'all 0.2s',
                                display: 'flex', flexDirection: 'column', minHeight: '80px',
                              }}
                              onMouseOver={(e) => { if (cell.inMonth && empCount > 0) { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(167,139,250,0.2)'; } }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = isToday ? 'var(--accent-primary)' : 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: isToday ? 'var(--accent-primary)' : cell.inMonth ? 'var(--text-main)' : 'var(--text-muted)' }}>{cell.date.getDate()}</span>
                                {isToday && <span style={{ fontSize: '0.6rem', background: 'var(--accent-primary)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>TODAY</span>}
                              </div>
                              {cell.inMonth && empCount > 0 && (
                                <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>👥</span> {empCount} scheduled
                                </div>
                              )}
                              {cell.inMonth && empCount === 0 && !schedLoading && (
                                <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>No shifts</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* --- EXPANDED DAY MODAL --- */}
      {expandedDay && (() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const expandDate = new Date(expandedDay + 'T00:00:00');
        const dayKey = dayNameMap[expandDate.getDay()];
        const expandedShifts = scheduleData.filter((emp: any) => emp.schedule && emp.schedule[dayKey] !== null);

        return (
          <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) setExpandedDay(null); }}>
            <div className="modal-card" style={{ maxWidth: '550px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                    {expandDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ background: 'var(--bg-input)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    {expandedShifts.length} employees
                  </span>
                </div>
                <span onClick={() => setExpandedDay(null)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</span>
              </div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 25px' }}>
                {expandedShifts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>No employees scheduled for this day.</div>
                ) : expandedShifts.map((emp: any) => (
                  <div
                    key={emp.user_id}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(167,139,250,0.06)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                    onClick={() => {
                      const dayShortMap: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
                      setExpandedDay(null);
                      setEditShiftModal({ show: true, empId: emp.user_id, empName: emp.name, day: dayShortMap[dayKey], currentShift: emp.schedule[dayKey].shift_name, newShiftId: '', scheduleId: emp.schedule_id });
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{emp.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{emp.schedule[dayKey].shift_name}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, textAlign: 'right' }}>
                      {emp.schedule[dayKey].time || ''}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '15px 25px' }}>
                <button className="btn-view" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} onClick={() => setExpandedDay(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- MODALS --- */}

      {/* 1. ORIGINAL ADD ACTIVITY MODAL WITH FIXES FOR DROPDOWN VISIBILITY */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <div className="modal-title">Add Future Activity</div>
            <div style={{ marginTop: "1rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Employee *</label>
                {/* ADDED class custom-select */}
                <select
                  className="select custom-select"
                  value={activityFormData.employee_id}
                  onChange={(e) => setActivityFormData({ ...activityFormData, employee_id: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {teamMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Activity Date *</label>
                <input
                  type="date"
                  className="select"
                  style={{ colorScheme: 'dark' }}
                  value={activityFormData.activity_date}
                  onChange={(e) => setActivityFormData({ ...activityFormData, activity_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: "1rem" }}>
                <div>
                  <label className="label-sm">Start Time *</label>
                  <input
                    type="time"
                    className="select"
                    style={{ colorScheme: 'dark' }}
                    value={activityFormData.start_time}
                    onChange={(e) => setActivityFormData({ ...activityFormData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-sm">End Time *</label>
                  <input
                    type="time"
                    className="select"
                    style={{ colorScheme: 'dark' }}
                    value={activityFormData.end_time}
                    onChange={(e) => setActivityFormData({ ...activityFormData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Activity Type *</label>
                {/* ADDED class custom-select */}
                <select
                  className="select custom-select"
                  value={activityFormData.activity_type}
                  onChange={(e) => setActivityFormData({ ...activityFormData, activity_type: e.target.value })}
                >
                  <option value="MEETING">Meeting</option>
                  <option value="TRAINING">Training</option>
                  <option value="LEAVE">Leave</option>
                  <option value="OFF_SITE">Off-site Work</option>
                  <option value="PROJECT">Project Deadline</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Notes *</label>
                <textarea
                  className="select"
                  rows={3}
                  placeholder="Enter activity details..."
                  style={{ resize: 'vertical' }}
                  value={activityFormData.notes}
                  onChange={(e) => setActivityFormData({ ...activityFormData, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
              <button className="modal-btn ghost" onClick={() => setShowActivityModal(false)}>Cancel</button>
              <button className="modal-btn ok" onClick={handleSaveActivity} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Activity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EDIT SHIFT MODAL */}
      {editShiftModal.show && (
        <div className="modal-overlay" onClick={() => setEditShiftModal({ ...editShiftModal, show: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-title" style={{ color: 'var(--accent-primary)' }}>Edit Shift</div>

            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
                Updating schedule for <strong style={{ color: 'var(--text-main)' }}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>.
              </p>

              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Shift</div>
                <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{editShiftModal.currentShift}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="label-sm">Assign New Shift</label>
                {/* ADDED class custom-select */}
                <select
                  className="select custom-select"
                  value={editShiftModal.newShiftId}
                  onChange={(e) => setEditShiftModal({ ...editShiftModal, newShiftId: e.target.value })}
                >
                  <option value="">-- Select a Shift --</option>
                  <option value="OFF">Day Off (No Shift)</option>
                  {shiftTemplates.map(shift => (
                    <option key={shift.shift_id} value={shift.shift_id}>
                      {shift.shift_name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
              <button className="modal-btn ghost" onClick={() => setEditShiftModal({ ...editShiftModal, show: false })}>Cancel</button>
              <button
                className="modal-btn ok"
                onClick={() => {
                  if (!editShiftModal.newShiftId) {
                    alert("Please select a new shift from the dropdown.");
                    return;
                  }
                  setSaveShiftConfirmModal(true);
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHIFT SAVE CONFIRMATION MODAL */}
      {saveShiftConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => setSaveShiftConfirmModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ padding: '20px 10px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--accent-primary)' }}>⚠️</div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.2rem', fontWeight: 700 }}>Confirm Shift Change</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Are you sure you want to change the shift for <strong style={{ color: 'var(--text-main)' }}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>?
              </p>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <button className="modal-btn ghost" onClick={() => setSaveShiftConfirmModal(false)}>Cancel</button>
              <button className="modal-btn ok" onClick={executeSaveShiftEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ASSIGN SCHEDULE MODAL */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-title" style={{ color: 'var(--accent-primary)' }}>Assign Schedule</div>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-sm">Employee *</label>
                <select
                  className="select custom-select"
                  value={assignForm.employee_id}
                  onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {teamMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label-sm">Shift *</label>
                <select
                  className="select custom-select"
                  value={assignForm.shift_id}
                  onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })}
                >
                  <option value="">Select Shift</option>
                  {shiftTemplates.map((shift: any) => (
                    <option key={shift.shift_id} value={shift.shift_id}>
                      {shift.shift_name} ({shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label-sm" style={{ marginBottom: '10px', display: 'block' }}>Days to Assign *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                    <label
                      key={day}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: assignForm.days[day] ? 'rgba(167, 139, 250, 0.15)' : 'var(--bg-input)',
                        border: `1px solid ${assignForm.days[day] ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: 600,
                        color: assignForm.days[day] ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={assignForm.days[day]}
                        onChange={(e) => setAssignForm({ ...assignForm, days: { ...assignForm.days, [day]: e.target.checked } })}
                        style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                      />
                      {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                    </label>
                  ))}
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: Object.values(assignForm.days).every(v => v) ? 'rgba(74, 222, 128, 0.15)' : 'var(--bg-input)',
                      border: `1px solid ${Object.values(assignForm.days).every(v => v) ? '#4ade80' : 'var(--border-subtle)'}`,
                      transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: 700,
                      color: Object.values(assignForm.days).every(v => v) ? '#4ade80' : 'var(--text-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Object.values(assignForm.days).every(v => v)}
                      onChange={(e) => {
                        const allChecked = e.target.checked;
                        setAssignForm({ ...assignForm, days: { monday: allChecked, tuesday: allChecked, wednesday: allChecked, thursday: allChecked, friday: allChecked, saturday: allChecked, sunday: allChecked } });
                      }}
                      style={{ accentColor: '#4ade80', width: '16px', height: '16px' }}
                    />
                    All
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="modal-btn ghost" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button
                className="modal-btn ok"
                onClick={() => {
                  if (!assignForm.employee_id) { alert('Please select an employee.'); return; }
                  if (!assignForm.shift_id) { alert('Please select a shift.'); return; }
                  const selectedDays = Object.entries(assignForm.days).filter(([, v]) => v).map(([k]) => k);
                  if (selectedDays.length === 0) { alert('Please select at least one day.'); return; }

                  // Check for conflicts
                  const empData = scheduleData.find((e: any) => e.user_id === assignForm.employee_id);
                  const conflictDays: string[] = [];
                  if (empData) {
                    selectedDays.forEach(day => {
                      if (empData.schedule && empData.schedule[day] !== null) {
                        conflictDays.push(day);
                      }
                    });
                  }

                  setAssignConfirmModal({ show: true, hasConflicts: conflictDays.length > 0, conflictDays });
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ASSIGN CONFIRM MODAL */}
      {assignConfirmModal.show && (
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => !assignSaving && setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ padding: '20px 10px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', color: assignConfirmModal.hasConflicts ? '#fbbf24' : 'var(--accent-primary)' }}>
                {assignConfirmModal.hasConflicts ? '⚠️' : '📋'}
              </div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.2rem', fontWeight: 700 }}>
                {assignConfirmModal.hasConflicts ? 'Schedule Conflict Detected' : 'Confirm Schedule Assignment'}
              </h3>
              {assignConfirmModal.hasConflicts ? (
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                    This employee already has a schedule on the following day(s):
                  </p>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {assignConfirmModal.conflictDays.map(d => (
                      <span key={d} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize', border: '1px solid rgba(251,191,36,0.3)' }}>{d}</span>
                    ))}
                  </div>
                  <p style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>
                    Saving will overwrite the existing schedule for these days.
                  </p>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>
                  Are you sure you want to assign this schedule?
                </p>
              )}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <button className="modal-btn ghost" onClick={() => setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] })} disabled={assignSaving}>Cancel</button>
              <button
                className="modal-btn ok"
                disabled={assignSaving}
                onClick={async () => {
                  setAssignSaving(true);
                  try {
                    const selectedDays = Object.entries(assignForm.days).filter(([, v]) => v).map(([k]) => k);
                    const shiftId = Number(assignForm.shift_id);

                    const payload: Record<string, any> = {
                      user_id: assignForm.employee_id,
                    };

                    // For each day: if selected set to shiftId, otherwise set to null (no shift)
                    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    allDays.forEach(day => {
                      payload[`${day}_shift_id`] = selectedDays.includes(day) ? shiftId : null;
                    });

                    // Check if employee already has a schedule (use update) or doesn't (use create)
                    const empData = scheduleData.find((e: any) => e.user_id === assignForm.employee_id);
                    let res;

                    if (empData && empData.schedule_id) {
                      // Update existing — but we need to preserve days NOT selected
                      const updatePayload: Record<string, any> = { schedule_id: empData.schedule_id };
                      allDays.forEach(day => {
                        if (selectedDays.includes(day)) {
                          updatePayload[`${day}_shift_id`] = shiftId;
                        }
                        // Don't include unselected days so they remain unchanged
                      });

                      res = await fetch('/api/supervisor/schedules/update', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatePayload),
                      });
                    } else {
                      // Create new schedule
                      res = await fetch('/api/supervisor/schedules/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                    }

                    if (res.ok) {
                      setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                      setShowAssignModal(false);
                      setAssignResultModal({ show: true, success: true, message: 'Schedule assigned successfully!' });
                      fetchScheduleData();
                    } else {
                      const data = await res.json();
                      setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                      setAssignResultModal({ show: true, success: false, message: data.message || 'Failed to assign schedule.' });
                    }
                  } catch (err) {
                    setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                    setAssignResultModal({ show: true, success: false, message: 'Connection error. Please try again.' });
                  } finally {
                    setAssignSaving(false);
                  }
                }}
              >
                {assignSaving ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Processing...
                  </span>
                ) : assignConfirmModal.hasConflicts ? 'Overwrite & Save' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ASSIGN RESULT MODAL */}
      {assignResultModal.show && (
        <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={() => setAssignResultModal({ show: false, success: false, message: '' })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ padding: '30px 20px' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>
                {assignResultModal.success ? '✅' : '❌'}
              </div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.2rem', fontWeight: 700 }}>
                {assignResultModal.success ? 'Success!' : 'Failed'}
              </h3>
              <p style={{ color: 'var(--text-muted)' }}>{assignResultModal.message}</p>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="modal-btn ok" onClick={() => setAssignResultModal({ show: false, success: false, message: '' })}>OK</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Global override for options inside custom-select */
        .custom-select option {
          background-color: #1e1e1e;
          color: #ffffff;
        }

        .shift-chip {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: rgba(167, 139, 250, 0.15);
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 4px;
          font-size: 0.85rem;
          font-family: var(--font-mono);
        }
        .shift-chip.off {
          background: rgba(156, 163, 175, 0.1);
          border-color: rgba(156, 163, 175, 0.2);
          color: var(--text-muted);
        }
        .employee-card {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 1.25rem;
          transition: all 0.3s ease;
        }
        .employee-card:hover {
          border-color: var(--accent-primary);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        .activity-card {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-left: 4px solid var(--accent-primary);
          border-radius: 10px;
          padding: 1rem;
          transition: all 0.3s ease;
        }
        .activity-card:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(167, 139, 250, 0.2);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}