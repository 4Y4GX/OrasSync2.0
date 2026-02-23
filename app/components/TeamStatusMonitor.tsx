"use client";

import { useState, useEffect } from "react";

/**
 * Format decimal hours to hours and minutes (e.g., 1.5 -> "1h 30m")
 */
function formatHoursMinutes(decimalHours: number | null | undefined): string {
  if (decimalHours == null || isNaN(decimalHours)) return "-";
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default to 10

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

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredTeam.length / itemsPerPage));
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentTeam = filteredTeam.slice(indexOfFirst, indexOfLast);

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
      {/* Filters and Controls */}
      <div className="glass-card">
        <div className="section-title" style={{ marginBottom: "1.5rem" }}>
          <span>Team Real-time Status</span>
          <div className="refresh-container">
            <label className="refresh-control">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="custom-checkbox" />
              AUTO-REFRESH (30S)
            </label>
            <button
              className="btn-refresh"
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
          <>
            <div style={{ overflowX: 'auto', width: '100%' }}>
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
                  {currentTeam.map((member) => (
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
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{member.name}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                          {member.email}
                        </div>
                      </td>
                      <td>{member.department}</td>
                      <td>{member.position}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {formatHoursMinutes(member.hours_today)}
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

            {/* Pagination Controls - moved below table for clarity */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-panel, rgba(255,255,255,0.02))',
              borderRadius: '8px',
              transition: 'background 0.45s ease',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 600 }}>Rows per page:</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {[5, 10, 15].map(num => (
                    <button
                      key={num}
                      onClick={() => { setItemsPerPage(num); setCurrentPage(1); }}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: itemsPerPage === num ? 'var(--accent-admin, #3b82f6)' : 'var(--bg-input, #222)',
                        color: itemsPerPage === num ? '#fff' : 'var(--text-muted, #aaa)',
                        border: itemsPerPage === num ? '1px solid var(--accent-admin, #3b82f6)' : '1px solid var(--border-subtle, #444)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: itemsPerPage === num ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #aaa)' }}>
                  Page <strong style={{ color: 'var(--text-main, #fff)' }}>{currentPage}</strong> of <strong style={{ color: 'var(--text-main, #fff)' }}>{totalPages}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: currentPage === 1 ? 'var(--bg-input, #222)' : 'var(--bg-panel, #333)',
                      color: currentPage === 1 ? 'var(--text-muted, #555)' : 'var(--text-main, #fff)',
                      border: '1px solid var(--border-subtle, #444)',
                      borderRadius: '4px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: currentPage === totalPages ? 'var(--bg-input, #222)' : 'var(--bg-panel, #333)',
                      color: currentPage === totalPages ? 'var(--text-muted, #555)' : 'var(--text-main, #fff)',
                      border: '1px solid var(--border-subtle, #444)',
                      borderRadius: '4px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
          {(() => {
            if (filteredTeam.length === 0) return null;
            const start = indexOfFirst + 1;
            const end = Math.min(indexOfLast, filteredTeam.length);
            return (
              <>
                Showing {start}-{end} of {filteredTeam.length} filtered team members
                {autoRefresh && " • Auto-refreshing every 30 seconds"}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
