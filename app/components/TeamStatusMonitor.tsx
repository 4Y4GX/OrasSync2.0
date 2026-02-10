"use client";

import { useState, useEffect } from "react";

// Updated type to include role_id or position for sorting
type TeamMemberStatus = {
  user_id: string;
  name: string;
  email: string;
  department: string;
  team: string; // This is the "Supervisor's Team" name
  position: string;
  role_id: number; // Needed for hierarchy sorting
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
  
  // Filters
  const [filterName, setFilterName] = useState("");
  const [filterTeam, setFilterTeam] = useState(""); 

  useEffect(() => {
    loadTeamStatus();
  }, []);

  const loadTeamStatus = async () => {
    try {
      // NOTE: Ensure your API returns 'role_id' and 'team' correctly
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

  // ✅ SORTING LOGIC: Hierarchy (Supervisor First) -> Alphabetical
  const sortedTeam = [...teamStatus].sort((a, b) => {
    // 1. Hierarchy: Higher role_id (or specific ID) comes first
    // Assuming Supervisor = 4, Employee = 1. We want 4 first.
    if (a.role_id !== b.role_id) {
        return b.role_id - a.role_id; // Descending order of role
    }
    // 2. Alphabetical by Name
    return a.name.localeCompare(b.name);
  });

  // ✅ FILTERING LOGIC
  const filteredTeam = sortedTeam.filter((member) => {
    const matchesName = 
      member.name.toLowerCase().includes(filterName.toLowerCase()) ||
      member.user_id.toLowerCase().includes(filterName.toLowerCase());
    
    const matchesTeam = filterTeam === "" || member.team === filterTeam;

    return matchesName && matchesTeam;
  });

  // Get unique teams for dropdown
  const uniqueTeams = Array.from(new Set(teamStatus.map(m => m.team))).filter(Boolean);

  return (
    <div>
      <div className="section-title" style={{ marginBottom: "1.5rem" }}>
        <span>Department Information</span>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {/* Search by Name/ID */}
        <input
          type="text"
          placeholder="Search member..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="input-rounded"
          style={{ flex: 1, minWidth: "200px" }}
        />

        {/* ✅ Select Supervisor's Team */}
        <select
            className="select"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{ minWidth: "200px" }}
        >
            <option value="">All Teams</option>
            {uniqueTeams.map(team => (
                <option key={team} value={team}>{team}</option>
            ))}
        </select>
      </div>

      <div className="table-container" style={{ maxHeight: "600px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Employee ID</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Position</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeam.map((member) => {
                // Split name for display requirements
                const names = member.name.split(' ');
                const firstName = names[0];
                const lastName = names.slice(1).join(' ');

                return (
                  <tr key={member.user_id} className={member.role_id === 4 ? "supervisor-row" : ""}>
                    <td style={{ fontWeight: 600 }}>{member.team}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{member.user_id}</td>
                    <td>{firstName}</td>
                    <td>{lastName}</td>
                    <td>
                        {member.role_id === 4 && "⭐ "} 
                        {member.position}
                    </td>
                    <td>
                      <span className={`status-badge ${member.status === 'Working' ? 'success' : 'neutral'}`}>
                        {member.status === 'Working' ? 'CLOCKED IN' : 'CLOCKED OUT'}
                      </span>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}