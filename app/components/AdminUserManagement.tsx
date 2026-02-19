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
  original_hire_date: string | null;
  resignation_date: string | null;
  original_resignation_date: string | null;
  D_tblrole: { role_name: string } | null;
  D_tblposition: { pos_name: string } | null;
  D_tbldepartment: { dept_name: string } | null;
  D_tblteam: { team_name: string } | null;
  D_tbluser_D_tbluser_supervisor_idToD_tbluser: { first_name: string; last_name: string } | null;
  D_tbluser_D_tbluser_manager_idToD_tbluser: { first_name: string; last_name: string } | null;
};

type Metadata = {
    roles: any[]; departments: any[]; positions: any[]; teams: any[]; supervisors: any[]; managers: any[];
};

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "DEACTIVATED">("ACTIVE");
  const [stats, setStats] = useState({ total: 0, active: 0 });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // NEW: Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Defaults to 10
  
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
  const [resultMessage, setResultMessage] = useState({ title: "", text: "", type: "success" });

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    user_id: "", first_name: "", last_name: "", email: "", role_id: "", pos_id: "", dept_id: "", team_id: "", supervisor_id: "", manager_id: "", account_status: "ACTIVE", password: "",
    hire_date: "", original_hire_date: "", resignation_date: "", original_resignation_date: ""
  });

  useEffect(() => {
    fetch("/api/admin/metadata")
      .then(res => {
          if (!res.ok) throw new Error("Metadata fetch failed");
          return res.json();
      })
      .then(setMetadata)
      .catch(err => console.error("Metadata Error:", err));
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            limit: "1000", // Increased limit so client-side pagination grabs everyone
            search: search,
            role: roleFilter,
        });

        if (activeTab === "ACTIVE") {
            params.append("status_exclude", "DEACTIVATED");
            if (statusFilter) params.append("status", statusFilter);
        } else {
            params.append("status", "DEACTIVATED");
        }

        const res = await fetch(`/api/admin/users/list?${params}`); 
        const data = await res.json();
        
        if (res.ok) {
            const fetchedUsers = data.users || [];
            setUsers(fetchedUsers);
            
            if (activeTab === "ACTIVE" && !search && !roleFilter && !statusFilter) {
                setStats({
                    total: data.pagination.total,
                    active: fetchedUsers.filter((u: User) => u.account_status === "ACTIVE").length
                });
            }
        }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // Reset to page 1 whenever filters or tabs change
  useEffect(() => { 
      setCurrentPage(1);
      loadUsers(); 
  }, [search, roleFilter, statusFilter, activeTab]);

  const sanitizeInput = (value: string, type: 'text' | 'email' | 'userid') => {
      if (!value) return "";
      switch(type) {
          case 'userid': return value.replace(/[^a-zA-Z0-9\-_]/g, ''); 
          case 'email': return value.replace(/[^a-zA-Z0-9@._-]/g, ''); 
          default: return value.replace(/[^a-zA-Z0-9\s\.\-\']/g, '');
      }
  };

  const handleOpenCreate = () => {
    setModalMode("create");
    setShowPassword(false); 
    setFormData({
        user_id: "", first_name: "", last_name: "", email: "", role_id: "", pos_id: "", dept_id: "", team_id: "", supervisor_id: "", manager_id: "", account_status: "ACTIVE", password: "",
        hire_date: new Date().toISOString().split('T')[0],
        original_hire_date: "", resignation_date: "", original_resignation_date: ""
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setModalMode("edit");
    setTargetUserId(user.user_id);
    setShowPassword(false); 
    setFormData({
        user_id: user.user_id,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        role_id: user.role_id?.toString() || "",
        pos_id: user.pos_id?.toString() || "",
        dept_id: user.dept_id?.toString() || "",
        team_id: user.team_id?.toString() || "",
        supervisor_id: user.supervisor_id || "",
        manager_id: user.manager_id || "",
        account_status: user.account_status || "ACTIVE",
        password: "",
        hire_date: user.hire_date ? new Date(user.hire_date).toISOString().split('T')[0] : "",
        original_hire_date: user.original_hire_date ? new Date(user.original_hire_date).toISOString().split('T')[0] : "",
        resignation_date: user.resignation_date ? new Date(user.resignation_date).toISOString().split('T')[0] : "",
        original_resignation_date: user.original_resignation_date ? new Date(user.original_resignation_date).toISOString().split('T')[0] : "",
    });
    setShowModal(true);
  };

  const executeDelete = async () => {
    setShowDeleteConfirm(false); 
    if (!targetUserId) return;

    try {
        const res = await fetch(`/api/admin/users/delete?user_id=${targetUserId}`, {
            method: "DELETE",
        });

        const data = await res.json();

        if (res.ok) {
            setUsers(prev => prev.filter(u => u.user_id !== targetUserId));
            setTargetUserId(null); 
            setShowModal(false);
            
            setResultMessage({
                title: "User Deactivated",
                text: "The user has been successfully deactivated and removed from the active list.",
                type: "success"
            });
            setShowResultModal(true);
        } else {
            setResultMessage({
                title: "Deactivation Failed",
                text: data.message || "Could not deactivate user.",
                type: "error"
            });
            setShowResultModal(true);
        }
    } catch (error) {
        setResultMessage({
            title: "System Error",
            text: "Failed to connect to the server.",
            type: "error"
        });
        setShowResultModal(true);
    }
  };

  const executeReactivate = async () => {
    setShowReactivateConfirm(false);

    const payload: any = { ...formData, account_status: "ACTIVE" };
    const cleanDate = (d: string) => (d && d.trim() !== "" ? d : null);
    
    payload.hire_date = cleanDate(payload.hire_date);
    payload.original_hire_date = cleanDate(payload.original_hire_date);
    payload.resignation_date = cleanDate(payload.resignation_date);
    payload.original_resignation_date = cleanDate(payload.original_resignation_date);
    
    if (payload.team_id === "") payload.team_id = null;
    if (payload.supervisor_id === "") payload.supervisor_id = null;
    if (payload.manager_id === "") payload.manager_id = null;

    try {
        const res = await fetch("/api/admin/users/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            setShowModal(false);
            loadUsers(); 
            setResultMessage({
                title: "User Reactivated",
                text: "The user has been successfully reactivated and restored to the active list.",
                type: "success"
            });
            setShowResultModal(true);
        } else {
            setResultMessage({
                title: "Reactivation Failed",
                text: data.message || "An unknown error occurred.",
                type: "error"
            });
            setShowResultModal(true);
        }
    } catch (error) {
        setResultMessage({
            title: "System Error",
            text: "Failed to connect to the server.",
            type: "error"
        });
        setShowResultModal(true);
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const executeSave = async () => {
    setShowConfirmModal(false);

    const url = modalMode === "create" ? "/api/admin/users/create" : "/api/admin/users/update";
    const method = modalMode === "create" ? "POST" : "PUT";

    const payload: any = { ...formData };
    
    const cleanDate = (d: string) => (d && d.trim() !== "" ? d : null);
    
    payload.hire_date = cleanDate(formData.hire_date);
    payload.original_hire_date = cleanDate(formData.original_hire_date);
    payload.resignation_date = cleanDate(formData.resignation_date);
    payload.original_resignation_date = cleanDate(formData.original_resignation_date);
    
    if (payload.team_id === "") payload.team_id = null;
    if (payload.supervisor_id === "") payload.supervisor_id = null;
    if (payload.manager_id === "") payload.manager_id = null;

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            setShowModal(false);
            loadUsers(); 
            setResultMessage({
                title: "Success",
                text: `User successfully ${modalMode === "create" ? "created" : "updated"}.`,
                type: "success"
            });
            setShowResultModal(true);
        } else {
            setResultMessage({
                title: `${modalMode === "create" ? "Creation" : "Update"} Failed`,
                text: data.message || "An unknown error occurred.",
                type: "error"
            });
            setShowResultModal(true);
        }
    } catch (error) {
        setResultMessage({
            title: "System Error",
            text: "Failed to connect to the server.",
            type: "error"
        });
        setShowResultModal(true);
    }
  };

  const darkSelectStyle = {
      backgroundColor: '#333',
      color: '#fff',
      border: '1px solid #555',
      padding: '8px',
      borderRadius: '4px'
  };

  const darkInputStyle = {
      backgroundColor: '#222',
      color: '#fff',
      border: '1px solid #444',
      padding: '10px',
      borderRadius: '6px',
      minWidth: '200px'
  };

  const isDeactivated = modalMode === "edit" && formData.account_status === "DEACTIVATED";

  const stickyHeaderStyle = {
    position: 'sticky',
    top: 0,
    backgroundColor: '#262626', 
    zIndex: 10, 
    boxShadow: '0 1px 0px #333' 
  } as React.CSSProperties;

  // NEW: Calculate Pagination Values
  const totalPages = Math.max(1, Math.ceil(users.length / itemsPerPage));
  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

  return (
    <div className="user-management-section">
      
      <div className="hud-row" style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem" }}>
        <div className="hud-card" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div className="hud-label" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#aaa', letterSpacing: '1px', marginBottom: '10px', textTransform: 'uppercase' }}>
            Total Users
          </div>
          <div className="hud-val" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ef4444' }}>
            {stats.total}
          </div>
          <div className="hud-bg-icon" style={{ position: 'absolute', right: '20px', bottom: '10px', fontSize: '3rem', opacity: 0.05 }}>👤</div>
        </div>

        <div className="hud-card" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div className="hud-label" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#aaa', letterSpacing: '1px', marginBottom: '10px', textTransform: 'uppercase' }}>
            Active Users
          </div>
          <div className="hud-val" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-go)' }}>
            {stats.active}
          </div>
          <div className="hud-bg-icon" style={{ position: 'absolute', right: '20px', bottom: '10px', fontSize: '3rem', opacity: 0.05 }}>✓</div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="section-title" style={{margin:0}}>User Management</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ 
                ...darkSelectStyle, 
                padding: '10px 15px', 
                borderRadius: '6px', 
                flex: 1,              
                minWidth: '220px',    
                maxWidth: '300px'     
            }}
          >
            <option value="">All Roles</option>
            {metadata?.roles?.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>

          {activeTab === "ACTIVE" && (
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ 
                    ...darkSelectStyle, 
                    padding: '10px 15px', 
                    borderRadius: '6px', 
                    flex: 1, 
                    minWidth: '220px', 
                    maxWidth: '300px' 
                }}
            >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
            </select>
          )}

          <input
            type="text"
            placeholder="Search users (Name, Email, Dept, Role)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
                ...darkInputStyle, 
                width: '360px', 
                flex: 'none'    
            }}
          />
      </div>

      <div className="glass-card">
        
        {activeTab === "ACTIVE" && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                <button 
                    onClick={handleOpenCreate}
                    style={{
                        backgroundColor: '#10b981', 
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 16px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
                    }}
                >
                    + Add User
                </button>
            </div>
        )}

        <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #333" }}>
          <button 
            onClick={() => { setActiveTab("ACTIVE"); setStatusFilter(""); }}
            style={{
              flex: 1,
              padding: "1rem",
              backgroundColor: "transparent",
              borderTopWidth: 0,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderBottom: activeTab === "ACTIVE" ? "3px solid var(--color-go)" : "3px solid transparent",
              color: activeTab === "ACTIVE" ? "var(--color-go)" : "#aaa",
              fontWeight: 800,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}
          >
            Active Accounts
          </button>

          <button 
            onClick={() => { setActiveTab("DEACTIVATED"); setStatusFilter(""); }}
            style={{
              flex: 1,
              padding: "1rem",
              backgroundColor: "transparent",
              borderTopWidth: 0,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderBottom: activeTab === "DEACTIVATED" ? "3px solid #ef4444" : "3px solid transparent",
              color: activeTab === "DEACTIVATED" ? "#ef4444" : "#aaa",
              fontWeight: 800,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}
          >
            Deactivated Accounts
          </button>
        </div>

        <div className="table-container" style={{ maxHeight: "600px", overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={stickyHeaderStyle}>Name</th>
                <th style={stickyHeaderStyle}>Email</th>
                <th style={stickyHeaderStyle}>Role</th>
                <th style={stickyHeaderStyle}>Department</th>
                <th style={stickyHeaderStyle}>Team</th>
                <th style={stickyHeaderStyle}>Position</th>
                <th style={stickyHeaderStyle}>Status</th>
                <th style={stickyHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
                {loading && (
                    <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
                            Loading users...
                        </td>
                    </tr>
                )}
                {!loading && currentUsers.length === 0 && (
                    <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
                            No users found in this category.
                        </td>
                    </tr>
                )}
                {/* UPDATED: Map over currentUsers instead of all users */}
                {!loading && currentUsers.length > 0 && currentUsers.map(user => (
                    <tr key={user.user_id}>
                        <td style={{fontWeight:600}}>{user.first_name} {user.last_name}</td>
                        <td>{user.email}</td>
                        <td>{user.D_tblrole?.role_name || "—"}</td>
                        <td>{user.D_tbldepartment?.dept_name || "—"}</td>
                        <td>{user.D_tblteam?.team_name || "—"}</td>
                        <td>{user.D_tblposition?.pos_name || "—"}</td>
                        <td>
                            <span className={`status-badge-admin ${user.account_status === "ACTIVE" ? "active" : "disabled"}`}>
                                {user.account_status || "NULL"}
                            </span>
                        </td>
                        <td>
                            <button 
                                className="btn-mini" 
                                onClick={() => handleOpenEdit(user)}
                                style={{ 
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff', 
                                    borderTopWidth: 0,
                                    borderLeftWidth: 0,
                                    borderRightWidth: 0,
                                    borderBottomWidth: 0, 
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                Edit
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* NEW: PAGINATION CONTROLS */}
        {!loading && users.length > 0 && (
          <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px' 
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
                                  backgroundColor: itemsPerPage === num ? '#3b82f6' : '#222',
                                  color: itemsPerPage === num ? '#fff' : '#aaa',
                                  border: itemsPerPage === num ? '1px solid #3b82f6' : '1px solid #444',
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
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
                      Page <strong style={{color: '#fff'}}>{currentPage}</strong> of <strong style={{color: '#fff'}}>{totalPages}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          style={{
                              padding: '6px 12px',
                              backgroundColor: currentPage === 1 ? '#222' : '#333',
                              color: currentPage === 1 ? '#555' : '#fff',
                              border: '1px solid #444',
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
                              backgroundColor: currentPage === totalPages ? '#222' : '#333',
                              color: currentPage === totalPages ? '#555' : '#fff',
                              border: '1px solid #444',
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
        )}

      </div>

      {showModal && (
        <div className="modal-overlay" style={{zIndex: 1000}}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{
              width: "800px", maxWidth: "95vw", backgroundColor: "#1a1a1a", border: "1px solid #333", color: "#eee"
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <div className="modal-title" style={{textTransform:'uppercase', letterSpacing:'1px'}}>
                    {modalMode === "create" ? "Add New Employee" : "Employee Details"}
                </div>
            </div>

            <form onSubmit={handlePreSubmit}>
                {modalMode === "create" && (
                     <div style={{marginBottom:'15px'}}>
                        <label className="label-sm">User ID (Required)</label>
                        <input type="text" className="modal-input" value={formData.user_id} onChange={e => setFormData({...formData, user_id: sanitizeInput(e.target.value, 'userid')})} required />
                    </div>
                )}

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                    <div>
                        <label className="label-sm">First Name</label>
                        <input type="text" className="modal-input" value={formData.first_name} onChange={e => setFormData({...formData, first_name: sanitizeInput(e.target.value, 'text')})} required />
                    </div>
                    <div>
                        <label className="label-sm">Last Name</label>
                        <input type="text" className="modal-input" value={formData.last_name} onChange={e => setFormData({...formData, last_name: sanitizeInput(e.target.value, 'text')})} required />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: modalMode === 'create' ? '1fr 1fr' : '1fr', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label className="label-sm">Email Address</label>
                        <input type="email" className="modal-input" value={formData.email} onChange={e => setFormData({...formData, email: sanitizeInput(e.target.value, 'email')})} required />
                    </div>
                    
                    {modalMode === "create" && (
                        <div>
                            <label className="label-sm">Initial Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    className="modal-input" 
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    required 
                                    style={{ width: '100%', paddingRight: '120px' }} 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: '#aaa',
                                        textTransform: 'uppercase',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '5px'
                                    }}
                                >
                                    {showPassword ? "Hide Password" : "Show Password"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                    <div>
                        <label className="label-sm">Account Status</label>
                        <select 
                            className="select" 
                            style={{
                                ...darkSelectStyle,
                                ...(isDeactivated ? { opacity: 0.5, cursor: "not-allowed" } : {})
                            }} 
                            value={formData.account_status} 
                            onChange={e => setFormData({...formData, account_status: e.target.value})}
                            disabled={isDeactivated}
                        >
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Disabled</option>
                            {formData.account_status === "DEACTIVATED" && (
                                <option value="DEACTIVATED">Deactivated</option>
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="label-sm">Position</label>
                        <select className="select" style={darkSelectStyle} value={formData.pos_id} onChange={e => setFormData({...formData, pos_id: e.target.value})} required>
                            <option value="">Select Position</option>
                            {metadata?.positions?.map(p => <option key={p.pos_id} value={p.pos_id}>{p.pos_name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                     <div>
                        <label className="label-sm">Department</label>
                        <select className="select" style={darkSelectStyle} value={formData.dept_id} onChange={e => setFormData({...formData, dept_id: e.target.value})} required>
                            <option value="">Select Department</option>
                            {metadata?.departments?.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label-sm">Role</label>
                        <select className="select" style={darkSelectStyle} value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})} required>
                            <option value="">Select Role</option>
                            {metadata?.roles?.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                    <div>
                        <label className="label-sm">Manager</label>
                        <select className="select" style={darkSelectStyle} value={formData.manager_id} onChange={e => setFormData({...formData, manager_id: e.target.value})}>
                            <option value="">N/A</option>
                            {metadata?.managers?.map(m => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label-sm">Supervisor</label>
                        <select className="select" style={darkSelectStyle} value={formData.supervisor_id} onChange={e => setFormData({...formData, supervisor_id: e.target.value})}>
                            <option value="">N/A</option>
                            {metadata?.supervisors?.map(s => <option key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{backgroundColor:'#222', padding:'15px', borderRadius:'8px', border:'1px solid #333'}}>
                    <div style={{color:'#ef4444', fontSize:'0.75rem', fontWeight:'bold', marginBottom:'10px', textTransform:'uppercase'}}>Employment History</div>
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'10px'}}>
                        <div>
                            <label className="label-sm">Original Hire Date</label>
                            <input 
                                type="date" 
                                className="modal-input" 
                                value={formData.original_hire_date} 
                                onChange={e => setFormData({...formData, original_hire_date: e.target.value})} 
                                disabled={modalMode === "edit"}
                                style={modalMode === "edit" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                            />
                        </div>
                        <div>
                            <label className="label-sm">Re-Hire Date</label>
                            <input 
                                type="text" 
                                className="modal-input" 
                                disabled 
                                placeholder="Pending logic..." 
                                style={{ opacity: 0.5, cursor: "not-allowed" }}
                            />
                        </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'10px'}}>
                        <div>
                            <label className="label-sm">Orig. Resignation</label>
                            <input 
                                type="date" 
                                className="modal-input" 
                                value={formData.original_resignation_date} 
                                onChange={e => setFormData({...formData, original_resignation_date: e.target.value})} 
                                disabled={modalMode === "edit"}
                                style={modalMode === "edit" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                            />
                        </div>
                        <div>
                            <label className="label-sm">Current Resignation</label>
                            <input 
                                type="date" 
                                className="modal-input" 
                                value={formData.resignation_date} 
                                onChange={e => setFormData({...formData, resignation_date: e.target.value})} 
                                disabled={modalMode === "edit"}
                                style={modalMode === "edit" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label-sm">System Entry Date</label>
                        <input 
                            type="date" 
                            className="modal-input" 
                            value={formData.hire_date} 
                            onChange={e => setFormData({...formData, hire_date: e.target.value})} 
                            disabled={modalMode === "edit"}
                            style={modalMode === "edit" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                        />
                    </div>
                </div>

                <div className="modal-actions" style={{marginTop:'20px', display: 'flex', justifyContent: 'space-between'}}>
                    <div>
                        {modalMode === "edit" && !isDeactivated && (
                            <button 
                                type="button" 
                                className="modal-btn danger" 
                                style={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 'bold' }}
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                DEACTIVATE USER
                            </button>
                        )}
                        {isDeactivated && (
                            <button 
                                type="button" 
                                className="modal-btn ok" 
                                style={{ backgroundColor: 'var(--color-go)', color: '#fff', fontWeight: 'bold' }}
                                onClick={() => setShowReactivateConfirm(true)}
                            >
                                REACTIVATE USER
                            </button>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="modal-btn ghost" onClick={() => setShowModal(false)}>CLOSE</button>
                        <button type="submit" className="modal-btn ok" style={{backgroundColor:'#eee', color:'#000', fontWeight:'bold'}}>SAVE CHANGES</button>
                    </div>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODALS */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: '1px solid #444'}}>
                <h3 style={{marginBottom:'1rem', color:'#fff'}}>Confirm Updates</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>Are you sure you want to apply these changes to the database?</p>
                <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
                    <button className="btn-action" onClick={() => setShowConfirmModal(false)} style={{backgroundColor: '#444'}}>
                        No, Go Back
                    </button>
                    <button className="btn-action" onClick={executeSave} style={{backgroundColor: 'var(--color-go)'}}>
                        Yes, {modalMode === 'create' ? 'Create' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: '1px solid #ef4444'}}>
                <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⚠️</div>
                <h3 style={{marginBottom:'1rem', color:'#fff'}}>Deactivate User?</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>
                    Are you sure you want to deactivate this user?
                    <br/><br/>
                    They will be removed from this active list immediately.
                </p>
                <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
                    <button className="btn-action" onClick={() => setShowDeleteConfirm(false)} style={{backgroundColor: '#444'}}>Cancel</button>
                    <button className="btn-action" onClick={executeDelete} style={{backgroundColor: '#ef4444', color: 'white'}}>Yes, Deactivate</button>
                </div>
            </div>
        </div>
      )}

      {/* REACTIVATE CONFIRMATION MODAL */}
      {showReactivateConfirm && (
        <div className="modal-overlay" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: '1px solid var(--color-go)'}}>
                <div style={{fontSize: '2rem', marginBottom: '1rem'}}>🔄</div>
                <h3 style={{marginBottom:'1rem', color:'#fff'}}>Reactivate User?</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>
                    Are you sure you want to reactivate this user?
                    <br/><br/>
                    They will immediately regain access to the system.
                </p>
                <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
                    <button className="btn-action" onClick={() => setShowReactivateConfirm(false)} style={{backgroundColor: '#444'}}>Cancel</button>
                    <button className="btn-action" onClick={executeReactivate} style={{backgroundColor: 'var(--color-go)', color: 'white'}}>Yes, Reactivate</button>
                </div>
            </div>
        </div>
      )}

      {/* RESULTS MODAL */}
      {showResultModal && (
        <div className="modal-overlay" style={{zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: resultMessage.type === 'success' ? '1px solid var(--color-go)' : '1px solid #ef4444'}}>
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>
                    {resultMessage.type === 'success' ? '✅' : '❌'}
                </div>
                <h3 style={{marginBottom:'0.5rem', color:'#fff'}}>{resultMessage.title}</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>{resultMessage.text}</p>
                <button 
                    className="btn-action" 
                    onClick={() => setShowResultModal(false)} 
                    style={{
                        backgroundColor: resultMessage.type === 'success' ? 'var(--color-go)' : '#ef4444', 
                        width: '100%'
                    }}
                >
                    Close
                </button>
            </div>
        </div>
      )}
    </div>
  );
}