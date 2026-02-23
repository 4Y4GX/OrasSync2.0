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
    D_tblweekly_schedule_monday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_friday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
    D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: { shift_name: string; start_time: string; end_time: string } | null;
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
  activity_id?: number;
  employee_id: string;
  employee_name: string;
  activity_date: string;
  activity_type: string;
  notes: string;
};

export default function SupervisorScheduleManagement() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDay, setSelectedDay] = useState('monday');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [futureActivities, setFutureActivities] = useState<FutureActivity[]>([]);
  const [activityFormData, setActivityFormData] = useState({
    employee_id: '',
    activity_date: '',
    activity_type: 'MEETING',
    notes: ''
  });
  const [formData, setFormData] = useState({
    monday_shift_id: "",
    tuesday_shift_id: "",
    wednesday_shift_id: "",
    thursday_shift_id: "",
    friday_shift_id: "",
    saturday_shift_id: "",
    sunday_shift_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersRes, shiftsRes] = await Promise.all([
        fetch("/api/supervisor/schedules/list"),
        fetch("/api/supervisor/shifts/list"),
      ]);

      if (membersRes.ok && shiftsRes.ok) {
        const membersData = await membersRes.json();
        const shiftsData = await shiftsRes.json();
        setTeamMembers(membersData.teamMembers || []);
        setShifts(shiftsData.shifts || []);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setMessage("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (member: TeamMember) => {
    setSelectedMember(member);
    
    const schedule = member.D_tblweekly_schedule[0];
    if (schedule) {
      setFormData({
        monday_shift_id: schedule.monday_shift_id?.toString() || "",
        tuesday_shift_id: schedule.tuesday_shift_id?.toString() || "",
        wednesday_shift_id: schedule.wednesday_shift_id?.toString() || "",
        thursday_shift_id: schedule.thursday_shift_id?.toString() || "",
        friday_shift_id: schedule.friday_shift_id?.toString() || "",
        saturday_shift_id: schedule.saturday_shift_id?.toString() || "",
        sunday_shift_id: schedule.sunday_shift_id?.toString() || "",
      });
    } else {
      setFormData({
        monday_shift_id: "",
        tuesday_shift_id: "",
        wednesday_shift_id: "",
        thursday_shift_id: "",
        friday_shift_id: "",
        saturday_shift_id: "",
        sunday_shift_id: "",
      });
    }
    
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setMessage("");

    try {
      const schedule = selectedMember.D_tblweekly_schedule[0];
      const url = schedule
        ? "/api/supervisor/schedules/update"
        : "/api/supervisor/schedules/create";
      const method = schedule ? "PUT" : "POST";

      const body: any = {
        ...formData,
        ...(schedule ? { schedule_id: schedule.schedule_id } : { user_id: selectedMember.user_id }),
      };

      // Convert empty strings to null
      Object.keys(body).forEach(key => {
        if (body[key] === "") body[key] = null;
        else if (body[key] && key !== "user_id" && key !== "schedule_id") body[key] = parseInt(body[key]);
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`Schedule ${schedule ? "updated" : "created"} successfully`);
        setShowModal(false);
        await loadData();
      } else {
        setMessage(data.message || "Failed to save schedule");
      }
    } catch (error) {
      setMessage("Failed to save schedule");
      console.error(error);
    }
  };

  const formatShiftDisplay = (shift: any) => {
    if (!shift) return <span className="shift-chip off">OFF</span>;
    const start = shift.start_time.substring(0, 5);
    const end = shift.end_time.substring(0, 5);
    return <span className="shift-chip">{`${start} - ${end}`}</span>;
  };

  const getMembersForDay = (day: string) => {
    const dayMap: Record<string, string> = {
      monday: 'D_tblweekly_schedule_monday_shift_idToD_tblshift_template',
      tuesday: 'D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template',
      wednesday: 'D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template',
      thursday: 'D_tblweekly_schedule_thursday_shift_idToD_tblshift_template',
      friday: 'D_tblweekly_schedule_friday_shift_idToD_tblshift_template',
      saturday: 'D_tblweekly_schedule_saturday_shift_idToD_tblshift_template',
      sunday: 'D_tblweekly_schedule_sunday_shift_idToD_tblshift_template',
    };
    
    return teamMembers.filter(member => {
      const schedule = member.D_tblweekly_schedule[0];
      if (!schedule) return false;
      const shift = schedule[dayMap[day] as keyof typeof schedule];
      return shift !== null;
    });
  };

  const handleAddActivity = () => {
    setActivityFormData({
      employee_id: '',
      activity_date: '',
      activity_type: 'MEETING',
      notes: ''
    });
    setShowActivityModal(true);
  };

  const handleSaveActivity = () => {
    if (!activityFormData.employee_id || !activityFormData.activity_date || !activityFormData.notes.trim()) {
      alert('Please fill all required fields');
      return;
    }

    const employee = teamMembers.find(m => m.user_id === activityFormData.employee_id);
    if (!employee) return;

    const newActivity: FutureActivity = {
      activity_id: Date.now(),
      employee_id: activityFormData.employee_id,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      activity_date: activityFormData.activity_date,
      activity_type: activityFormData.activity_type,
      notes: activityFormData.notes
    };

    setFutureActivities([...futureActivities, newActivity]);
    setShowActivityModal(false);
    setMessage('Future activity added successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteActivity = (activityId: number) => {
    setFutureActivities(futureActivities.filter(a => a.activity_id !== activityId));
    setMessage('Activity removed');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div>
      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.includes("success") || message.includes("added") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${message.includes("success") || message.includes("added") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: "8px",
            color: message.includes("success") || message.includes("added") ? "#22c55e" : "#ef4444",
          }}
        >
          {message}
        </div>
      )}

      {/* Future Activities Panel */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📅 Future Activities</span>
          <button className="btn-mini supervisor-btn" onClick={handleAddActivity}>
            + Add Activity
          </button>
        </div>
        
        {futureActivities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No future activities scheduled. Click "Add Activity" to plan ahead.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {futureActivities.map((activity) => (
              <div key={activity.activity_id} className="activity-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{activity.employee_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(activity.activity_date).toLocaleDateString()}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteActivity(activity.activity_id!)}
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
                  marginBottom: '0.75rem'
                }}>
                  {activity.activity_type}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{activity.notes}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span>Team Schedule</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setViewMode('weekly')}
            >
              📅 Weekly View
            </button>
            <button 
              className={`view-mode-btn ${viewMode === 'daily' ? 'active' : ''}`}
              onClick={() => setViewMode('daily')}
            >
              📆 Daily View
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>Loading...</div>
        ) : teamMembers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            No team members found
          </div>
        ) : (
          <>
            {viewMode === 'weekly' ? (
              <div className="table-container" style={{ maxHeight: "600px" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, background: "var(--bg-panel)", zIndex: 10 }}>Employee</th>
                      <th>Department</th>
                      <th>Mon</th>
                      <th>Tue</th>
                      <th>Wed</th>
                      <th>Thu</th>
                      <th>Fri</th>
                      <th>Sat</th>
                      <th>Sun</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => {
                      const schedule = member.D_tblweekly_schedule[0];
                      return (
                        <tr key={member.user_id}>
                          <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "var(--bg-panel)" }}>
                            {member.first_name} {member.last_name}
                          </td>
                          <td>{member.D_tbldepartment?.dept_name || "—"}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_monday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_thursday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_friday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_saturday_shift_idToD_tblshift_template)}</td>
                          <td>{formatShiftDisplay(schedule?.D_tblweekly_schedule_sunday_shift_idToD_tblshift_template)}</td>
                          <td>
                            <button className="btn-mini supervisor-btn" onClick={() => openEditModal(member)}>
                              {schedule ? "Edit" : "Set Schedule"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                {/* Day Selector */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  marginBottom: '1.5rem', 
                  flexWrap: 'wrap',
                  padding: '0.5rem',
                  background: 'var(--bg-input)',
                  borderRadius: '12px'
                }}>
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <button
                      key={day}
                      className={`day-selector-btn ${selectedDay === day ? 'active' : ''}`}
                      onClick={() => setSelectedDay(day)}
                    >
                      {day.substring(0, 3).toUpperCase()}
                    </button>
                  ))}
                </div>
                
                {/* Daily View */}
                <div>
                  <h3 style={{ 
                    fontSize: '1.3rem', 
                    fontWeight: 700, 
                    marginBottom: '1rem',
                    textTransform: 'capitalize',
                    color: 'var(--text-main)'
                  }}>
                    {selectedDay} Schedule
                  </h3>
                  
                  {getMembersForDay(selectedDay).length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '3rem', 
                      color: 'var(--text-muted)',
                      background: 'var(--bg-input)',
                      borderRadius: '12px'
                    }}>
                      No employees scheduled for {selectedDay}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {getMembersForDay(selectedDay).map((member) => {
                        const schedule = member.D_tblweekly_schedule[0];
                        const dayShiftMap: Record<string, any> = {
                          monday: schedule?.D_tblweekly_schedule_monday_shift_idToD_tblshift_template,
                          tuesday: schedule?.D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template,
                          wednesday: schedule?.D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template,
                          thursday: schedule?.D_tblweekly_schedule_thursday_shift_idToD_tblshift_template,
                          friday: schedule?.D_tblweekly_schedule_friday_shift_idToD_tblshift_template,
                          saturday: schedule?.D_tblweekly_schedule_saturday_shift_idToD_tblshift_template,
                          sunday: schedule?.D_tblweekly_schedule_sunday_shift_idToD_tblshift_template,
                        };
                        const shift = dayShiftMap[selectedDay];
                        
                        return (
                          <div key={member.user_id} className="employee-card">
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                {member.first_name} {member.last_name}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {member.D_tbldepartment?.dept_name || 'No Department'}
                              </div>
                            </div>
                            
                            {shift && (
                              <div style={{ 
                                padding: '0.75rem',
                                background: 'rgba(167, 139, 250, 0.1)',
                                border: '1px solid rgba(167, 139, 250, 0.3)',
                                borderRadius: '8px'
                              }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                  Shift Time
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                                  {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                  {shift.shift_name}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Schedule Modal */}
      {showModal && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px", maxHeight: "90vh", overflow: "auto" }}>
            <div className="modal-title">
              Set Schedule for {selectedMember.first_name} {selectedMember.last_name}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: "1rem" }}>
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                  <div key={day}>
                    <label className="label-sm" style={{ textTransform: "capitalize" }}>
                      {day}
                    </label>
                    <select
                      className="select"
                      value={formData[`${day}_shift_id` as keyof typeof formData]}
                      onChange={(e) =>
                        setFormData({ ...formData, [`${day}_shift_id`]: e.target.value })
                      }
                    >
                      <option value="">Day Off</option>
                      {shifts.map((shift) => (
                        <option key={shift.shift_id} value={shift.shift_id}>
                          {shift.shift_name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                <button type="button" className="modal-btn ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-btn ok">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Future Activity Modal */}
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
              <button className="modal-btn ghost" onClick={() => setShowActivityModal(false)}>
                Cancel
              </button>
              <button className="modal-btn ok" onClick={handleSaveActivity}>
                Save Activity
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

        .view-mode-btn {
          padding: 0.5rem 1rem;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-main);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .view-mode-btn:hover {
          background: rgba(167, 139, 250, 0.1);
          border-color: var(--accent-primary);
        }

        .view-mode-btn.active {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }

        .day-selector-btn {
          flex: 1;
          min-width: 60px;
          padding: 0.75rem 0.5rem;
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-main);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.85rem;
        }

        .day-selector-btn:hover {
          background: rgba(167, 139, 250, 0.1);
          border-color: var(--accent-primary);
        }

        .day-selector-btn.active {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
          transform: scale(1.05);
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
