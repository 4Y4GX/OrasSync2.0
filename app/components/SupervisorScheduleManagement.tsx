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

export default function SupervisorScheduleManagement() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
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

  return (
    <div>
      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${message.includes("success") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: "8px",
            color: message.includes("success") ? "#22c55e" : "#ef4444",
          }}
        >
          {message}
        </div>
      )}

      <div className="glass-card">
        <div className="section-title">Team Weekly Schedule</div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>Loading...</div>
        ) : teamMembers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            No team members found
          </div>
        ) : (
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
      `}</style>
    </div>
  );
}
