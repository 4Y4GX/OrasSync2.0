"use client";

import { useState, useEffect } from "react";

type User = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
  pos_id: number;
  dept_id: number;
  team_id: number | null;
  account_status: string;
  supervisor_id: string | null;
  manager_id: string | null;
  hire_date: string;
  resignation_date: string | null;
  D_tblrole: { role_name: string } | null;
  D_tblposition: { pos_name: string } | null;
  D_tbldepartment: { dept_name: string } | null;
  D_tblteam: { team_name: string } | null;
};

type Metadata = {
  roles: Array<{ role_id: number; role_name: string }>;
  departments: Array<{ dept_id: number; dept_name: string }>;
  positions: Array<{ pos_id: number; pos_name: string }>;
  teams: Array<{ team_id: number; team_name: string; dept_id: number }>;
  supervisors: Array<{ user_id: string; first_name: string; last_name: string }>;
  managers: Array<{ user_id: string; first_name: string; last_name: string }>;
};

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    user_id: "",
    first_name: "",
    last_name: "",
    email: "",
    role_id: "",
    pos_id: "",
    dept_id: "",
    team_id: "",
    supervisor_id: "",
    manager_id: "",
    hire_date: "",
    password: "",
    account_status: "ACTIVE",
  });

  // Load metadata
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/metadata");
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
        }
      } catch (error) {
        console.error("Failed to load metadata:", error);
      }
    })();
  }, []);

  // Load users
  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/users/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      } else {
        setMessage("Failed to load users");
      }
    } catch (error) {
      setMessage("Failed to load users");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search, roleFilter, statusFilter]);

  const openCreateModal = () => {
    setModalMode("create");
    setFormData({
      user_id: "",
      first_name: "",
      last_name: "",
      email: "",
      role_id: "",
      pos_id: "",
      dept_id: "",
      team_id: "",
      supervisor_id: "",
      manager_id: "",
      hire_date: new Date().toISOString().split("T")[0],
      password: "",
      account_status: "ACTIVE",
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormData({
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role_id: user.role_id.toString(),
      pos_id: user.pos_id.toString(),
      dept_id: user.dept_id.toString(),
      team_id: user.team_id?.toString() || "",
      supervisor_id: user.supervisor_id || "",
      manager_id: user.manager_id || "",
      hire_date: user.hire_date.split("T")[0],
      password: "",
      account_status: user.account_status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const url = modalMode === "create" ? "/api/admin/users/create" : "/api/admin/users/update";
      const method = modalMode === "create" ? "POST" : "PUT";

      const body: any = {
        user_id: formData.user_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role_id: formData.role_id,
        pos_id: formData.pos_id,
        dept_id: formData.dept_id,
        team_id: formData.team_id || null,
        supervisor_id: formData.supervisor_id || null,
        manager_id: formData.manager_id || null,
        hire_date: formData.hire_date,
        account_status: formData.account_status,
      };

      if (modalMode === "create" && formData.password) {
        body.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`User ${modalMode === "create" ? "created" : "updated"} successfully`);
        setShowModal(false);
        await loadUsers();
      } else {
        setMessage(data.message || `Failed to ${modalMode} user`);
      }
    } catch (error) {
      setMessage(`Failed to ${modalMode} user`);
      console.error(error);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/delete?user_id=${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("User deactivated successfully");
        await loadUsers();
      } else {
        setMessage(data.message || "Failed to delete user");
      }
    } catch (error) {
      setMessage("Failed to delete user");
      console.error(error);
    }
  };

  const filteredTeams = metadata?.teams.filter(
    (team) => team.dept_id.toString() === formData.dept_id
  ) || [];

  return (
    <div className="user-management-section">
      <div className="hud-row" style={{ marginBottom: "2rem" }}>
        <div className="hud-card">
          <div className="hud-label">Total Users</div>
          <div className="hud-val admin-accent">{users.length}</div>
          <div className="hud-bg-icon">👤</div>
        </div>
        <div className="hud-card">
          <div className="hud-label">Active Users</div>
          <div className="hud-val" style={{ color: "var(--color-go)" }}>
            {users.filter((u) => u.account_status === "ACTIVE").length}
          </div>
          <div className="hud-bg-icon">✓</div>
        </div>
        <div className="hud-card">
          <div className="hud-label">Deactivated</div>
          <div className="hud-val" style={{ color: "var(--color-urgent)" }}>
            {users.filter((u) => u.account_status === "DEACTIVATED").length}
          </div>
          <div className="hud-bg-icon">✗</div>
        </div>
      </div>

      <div className="glass-card">
        <div className="section-title" style={{ marginBottom: "1.5rem" }}>
          <span>User Management</span>
          <button className="btn-add admin-btn" onClick={openCreateModal}>
            + Add User
          </button>
        </div>

        {message && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              background: message.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${message.includes("success") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: "8px",
              color: message.includes("success") ? "#22c55e" : "#ef4444",
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-rounded"
            style={{ flex: 1, minWidth: "200px" }}
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="select"
            style={{ minWidth: "150px" }}
          >
            <option value="">All Roles</option>
            {metadata?.roles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="select"
            style={{ minWidth: "150px" }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>

        <div className="table-container" style={{ maxHeight: "500px" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{user.user_id}</td>
                    <td style={{ fontWeight: 600 }}>
                      {user.first_name} {user.last_name}
                    </td>
                    <td>{user.email}</td>
                    <td>{user.D_tblrole?.role_name || "—"}</td>
                    <td>{user.D_tbldepartment?.dept_name || "—"}</td>
                    <td>{user.D_tblposition?.pos_name || "—"}</td>
                    <td>
                      <span
                        className={`status-badge-admin ${
                          user.account_status === "ACTIVE"
                            ? "active"
                            : user.account_status === "DISABLED"
                            ? "disabled"
                            : "deactivated"
                        }`}
                      >
                        {user.account_status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-mini admin-btn" onClick={() => openEditModal(user)}>
                        Edit
                      </button>
                      {user.account_status !== "DEACTIVATED" && (
                        <button
                          className="btn-mini"
                          style={{ marginLeft: "0.5rem", background: "#ef4444" }}
                          onClick={() => handleDelete(user.user_id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}>
          <button
            className="btn-action btn-standard"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
          <span style={{ padding: "0.5rem 1rem" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-action btn-standard"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", maxHeight: "90vh", overflow: "auto" }}>
            <div className="modal-title">{modalMode === "create" ? "Create New User" : "Edit User"}</div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <label className="label-sm">User ID</label>
                  <input
                    type="text"
                    className="modal-input"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    required
                    disabled={modalMode === "edit"}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="label-sm">First Name</label>
                    <input
                      type="text"
                      className="modal-input"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-sm">Last Name</label>
                    <input
                      type="text"
                      className="modal-input"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label-sm">Email</label>
                  <input
                    type="email"
                    className="modal-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                {modalMode === "create" && (
                  <div>
                    <label className="label-sm">Password (min 8 characters)</label>
                    <input
                      type="password"
                      className="modal-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={modalMode === "create"}
                      minLength={8}
                    />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="label-sm">Role</label>
                    <select
                      className="select"
                      value={formData.role_id}
                      onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                      required
                    >
                      <option value="">Select Role</option>
                      {metadata?.roles.map((role) => (
                        <option key={role.role_id} value={role.role_id}>
                          {role.role_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-sm">Position</label>
                    <select
                      className="select"
                      value={formData.pos_id}
                      onChange={(e) => setFormData({ ...formData, pos_id: e.target.value })}
                      required
                    >
                      <option value="">Select Position</option>
                      {metadata?.positions.map((pos) => (
                        <option key={pos.pos_id} value={pos.pos_id}>
                          {pos.pos_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="label-sm">Department</label>
                    <select
                      className="select"
                      value={formData.dept_id}
                      onChange={(e) => setFormData({ ...formData, dept_id: e.target.value, team_id: "" })}
                      required
                    >
                      <option value="">Select Department</option>
                      {metadata?.departments.map((dept) => (
                        <option key={dept.dept_id} value={dept.dept_id}>
                          {dept.dept_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-sm">Team (Optional)</label>
                    <select
                      className="select"
                      value={formData.team_id}
                      onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    >
                      <option value="">No Team</option>
                      {filteredTeams.map((team) => (
                        <option key={team.team_id} value={team.team_id}>
                          {team.team_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="label-sm">Supervisor (Optional)</label>
                    <select
                      className="select"
                      value={formData.supervisor_id}
                      onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
                    >
                      <option value="">No Supervisor</option>
                      {metadata?.supervisors.map((sup) => (
                        <option key={sup.user_id} value={sup.user_id}>
                          {sup.first_name} {sup.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-sm">Manager (Optional)</label>
                    <select
                      className="select"
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    >
                      <option value="">No Manager</option>
                      {metadata?.managers.map((mgr) => (
                        <option key={mgr.user_id} value={mgr.user_id}>
                          {mgr.first_name} {mgr.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="label-sm">Hire Date</label>
                    <input
                      type="date"
                      className="modal-input"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      required
                    />
                  </div>

                  {modalMode === "edit" && (
                    <div>
                      <label className="label-sm">Status</label>
                      <select
                        className="select"
                        value={formData.account_status}
                        onChange={(e) => setFormData({ ...formData, account_status: e.target.value })}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="DISABLED">Disabled</option>
                        <option value="DEACTIVATED">Deactivated</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                <button type="button" className="modal-btn ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-btn ok">
                  {modalMode === "create" ? "Create User" : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
