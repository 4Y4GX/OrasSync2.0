"use client";

import { useState, useEffect } from "react";

type TeamMemberStatus = {
  user_id: string;
  name: string;
  email: string;
  department: string;
  team: string;
  position: string;
  status: string;
  hours_today: number;
  current_activity: string;
  is_billable: boolean;
  clock_in_time: string | null;
  clock_out_time: string | null;
};

export default function TeamStatusMonitor() {
  const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadTeamStatus();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadTeamStatus();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadTeamStatus = async () => {
    try {
      const res = await fetch("/api/supervisor/team/status");
      if (res.ok) {
        const data = await res.json();
        setTeamStatus(data.teamStatus || []);
      }
    } catch (error) {
      console.error("Failed to load team status:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeam = teamStatus.filter((member) => {
    const matchesSearch = 
      filter === "" ||
      member.name.toLowerCase().includes(filter.toLowerCase()) ||
      member.email.toLowerCase().includes(filter.toLowerCase()) ||
      member.department.toLowerCase().includes(filter.toLowerCase());

    const matchesStatus = statusFilter === "" || member.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: teamStatus.length,
    working: teamStatus.filter((m) => m.status === "Working").length,
    offline: teamStatus.filter((m) => m.status === "Offline").length,
    clockedOut: teamStatus.filter((m) => m.status === "Clocked Out").length,
    totalHours: teamStatus.reduce((sum, m) => sum + m.hours_today, 0),
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Working":
        return "var(--color-go)";
      case "Clocked Out":
        return "var(--color-accent)";
      case "Offline":
      default:
        return "var(--text-muted)";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Working":
        return "●";
      case "Clocked Out":
        return "◐";
      case "Offline":
      default:
        return "○";
    }
  };

  return (
    <div>
      {/* Stats Row */}
      <div className="hud-row" style={{ marginBottom: "2rem" }}>
        <div className="hud-card">
          <div className="hud-label">Team Members</div>
          <div className="hud-val supervisor-accent">{stats.total}</div>
          <div className="hud-bg-icon">👥</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Currently Working</div>
          <div className="hud-val" style={{ color: "var(--color-go)" }}>
            {stats.working}
          </div>
          <div className="hud-bg-icon">✓</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Total Hours Today</div>
          <div className="hud-val">{stats.totalHours.toFixed(1)}</div>
          <div className="hud-bg-icon">⏱</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Offline</div>
          <div className="hud-val" style={{ color: "var(--text-muted)" }}>
            {stats.offline}
          </div>
          <div className="hud-bg-icon">○</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="glass-card">
        <div className="section-title" style={{ marginBottom: "1.5rem" }}>
          <span>Team Real-time Status</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (30s)
            </label>
            <button
              className="btn-mini supervisor-btn"
              onClick={loadTeamStatus}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-rounded"
            style={{ flex: 1, minWidth: "250px" }}
          />

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: "150px" }}
          >
            <option value="">All Statuses</option>
            <option value="Working">Working</option>
            <option value="Clocked Out">Clocked Out</option>
            <option value="Offline">Offline</option>
          </select>
        </div>

        {loading && teamStatus.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            Loading team status...
          </div>
        ) : filteredTeam.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            No team members found
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: "600px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Hours Today</th>
                  <th>Current Activity</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.map((member) => (
                  <tr key={member.user_id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.2rem",
                            color: getStatusColor(member.status),
                          }}
                        >
                          {getStatusIcon(member.status)}
                        </span>
                        <span style={{ color: getStatusColor(member.status), fontWeight: 600 }}>
                          {member.status}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{member.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {member.email}
                      </div>
                    </td>
                    <td>{member.department}</td>
                    <td>{member.position}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {member.hours_today.toFixed(2)}h
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {member.is_billable && member.status === "Working" && (
                          <span title="Billable" style={{ fontSize: "1rem" }}>
                            💰
                          </span>
                        )}
                        <span>{member.current_activity}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                      {formatTime(member.clock_in_time)}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                      {formatTime(member.clock_out_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
          Showing {filteredTeam.length} of {teamStatus.length} team members
          {autoRefresh && " • Auto-refreshing every 30 seconds"}
        </div>
      </div>
    </div>
  );
}
