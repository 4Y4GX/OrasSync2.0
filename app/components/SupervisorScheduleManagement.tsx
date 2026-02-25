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
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]); 
  const [schedLoading, setSchedLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Modals matching Manager Dashboard flow, styled with Supervisor CSS
  const [editShiftModal, setEditShiftModal] = useState({
      show: false, empId: "", empName: "", day: "", currentShift: "", newShiftId: "", scheduleId: null as number | null 
  });
  const [saveShiftConfirmModal, setSaveShiftConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Original Supervisor Add Activity Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [futureActivities, setFutureActivities] = useState<FutureActivity[]>([]);
  const [futureLoading, setFutureLoading] = useState(true);
  
  const [activityFormData, setActivityFormData] = useState({
    employee_id: '',
    activity_date: '',
    activity_type: 'MEETING',
    notes: ''
  });

  const fetchScheduleData = async () => {
    setSchedLoading(true);
    try {
      const res = await fetch('/api/supervisor/schedules/list');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.teamMembers || []);
        
        // Helper to format Prisma db.Time into a readable 12-hour format
        const formatTime = (dateObj: Date | string | null) => {
            if (!dateObj) return null;
            return new Date(dateObj).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        };

        // Restructure the data to match the grid logic
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
    if (!activityFormData.employee_id || !activityFormData.activity_date || !activityFormData.notes.trim()) {
      alert('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    try {
      // Map string type to integer ID for the database
      const activityMap: Record<string, number> = {
        'MEETING': 1, 'TRAINING': 2, 'LEAVE': 3, 'OFF_SITE': 4, 'PROJECT': 5, 'OTHER': 6
      };

      const res = await fetch('/api/supervisor/future-schedule/create', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id: activityFormData.employee_id, 
            shift_date: activityFormData.activity_date, 
            start_time: '09:00', // Auto-filled since the original form didn't ask for it
            end_time: '17:00', 
            activity_id: activityMap[activityFormData.activity_type] || 1, 
            notes: activityFormData.notes 
        })
      });

      if (res.ok) { 
          setMessage("Future activity added successfully!"); 
          setTimeout(() => setMessage(''), 3000);
          setShowActivityModal(false); 
          setActivityFormData({ employee_id: '', activity_date: '', activity_type: 'MEETING', notes: '' }); 
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
                  {activity.is_billable && <span style={{color: '#22c55e'}}>💰</span>}
                </div>
                {activity.start_time && activity.end_time && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', gap: '10px' }}>
                    <span style={{fontFamily: 'var(--font-mono)'}}>🕐 {activity.start_time} - {activity.end_time}</span>
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

      {/* Team Schedule Panel (Manager-Style Grid) */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ marginRight: '10px' }}>Team Schedule</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>
              {calendarView === 'weekly' ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Month of ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setCalendarView('weekly')} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', background: calendarView === 'weekly' ? 'var(--accent-primary)' : 'transparent', color: calendarView === 'weekly' ? '#fff' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>Weekly</button>
              <button onClick={() => setCalendarView('monthly')} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', background: calendarView === 'monthly' ? 'var(--accent-primary)' : 'transparent', color: calendarView === 'monthly' ? '#fff' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>Monthly</button>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() - 7) : newDate.setMonth(newDate.getMonth() - 1); setCurrentDate(newDate); }}>← Prev</button>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setCurrentDate(new Date())}>Today</button>
              <button className="btn-view" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() + 7) : newDate.setMonth(newDate.getMonth() + 1); setCurrentDate(newDate); }}>Next →</button>
            </div>
            <button className="btn-mini supervisor-btn" onClick={() => setShowActivityModal(true)}>+ Add Activity</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: '600px' }}>
          {calendarView === 'weekly' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', height: '100%' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const dayKeyMap: Record<string, string> = { 'Mon':'monday', 'Tue':'tuesday', 'Wed':'wednesday', 'Thu':'thursday', 'Fri':'friday', 'Sat':'saturday', 'Sun':'sunday' };
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Monthly view coming soon...</div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. ORIGINAL ADD ACTIVITY MODAL (REVERTED) */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <div className="modal-title">Add Future Activity</div>
            <div style={{ marginTop: "1rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Employee *</label>
                <select
                  className="select"
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
                  value={activityFormData.activity_date}
                  onChange={(e) => setActivityFormData({ ...activityFormData, activity_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="label-sm">Activity Type *</label>
                <select
                  className="select"
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
                  value={activityFormData.notes}
                  onChange={(e) => setActivityFormData({ ...activityFormData, notes: e.target.value })}
                  style={{ resize: 'vertical' }}
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
                        Updating schedule for <strong style={{color: 'var(--text-main)'}}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>.
                    </p>
                    
                    <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Shift</div>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{editShiftModal.currentShift}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label className="label-sm">Assign New Shift</label>
                        <select 
                            className="select"
                            value={editShiftModal.newShiftId}
                            onChange={(e) => setEditShiftModal({...editShiftModal, newShiftId: e.target.value})}
                        >
                            <option value="">-- Select a Shift --</option>
                            <option value="OFF">Day Off (No Shift)</option>
                            {shiftTemplates.map(shift => (
                                <option key={shift.shift_id} value={shift.shift_id}>
                                    {shift.shift_name} ({shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)})
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
                  Are you sure you want to change the shift for <strong style={{color:'var(--text-main)'}}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>?
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

      <style jsx>{`
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
      `}</style>
    </div>
  );
}