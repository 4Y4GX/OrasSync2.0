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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // FILTERS STATE (Restored)
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // MODAL STATES
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [resultMessage, setResultMessage] = useState({ title: "", text: "", type: "success" });

  const [formData, setFormData] = useState({
    user_id: "", first_name: "", last_name: "", email: "", role_id: "", pos_id: "", dept_id: "", team_id: "", supervisor_id: "", manager_id: "", account_status: "ACTIVE", password: "",
    hire_date: "", original_hire_date: "", resignation_date: "", original_resignation_date: ""
  });

  // Load Metadata Safely
  useEffect(() => {
    fetch("/api/admin/metadata")
      .then(res => {
          if (!res.ok) throw new Error("Metadata fetch failed");
          return res.json();
      })
      .then(setMetadata)
      .catch(err => console.error("Metadata Error:", err));
  }, []);

  // Load Users
  const loadUsers = async () => {
    setLoading(true);
    setSelectedUserIds([]); 
    try {
        const params = new URLSearchParams({
            limit: "50",
            status_exclude: "DEACTIVATED",
            search: search,          // Connected
            role: roleFilter,        // Connected
            status: statusFilter     // Connected
        });

        const res = await fetch(`/api/admin/users/list?${params}`); 
        const data = await res.json();
        if (res.ok) setUsers(data.users || []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // Reload when filters change
  useEffect(() => { loadUsers(); }, [search, roleFilter, statusFilter]);

  // --- HELPER: Sanitization ---
  const sanitizeInput = (value: string, type: 'text' | 'email' | 'userid') => {
      if (!value) return "";
      switch(type) {
          case 'userid': return value.replace(/[^a-zA-Z0-9\-_]/g, ''); 
          case 'email': return value.replace(/[^a-zA-Z0-9@._-]/g, ''); 
          default: return value.replace(/[^a-zA-Z0-9\s\.\-\']/g, '');
      }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.checked) setSelectedUserIds([]);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? [] : [userId]);
  };

  const handleOpenEdit = () => {
    if (selectedUserIds.length !== 1) return;
    const user = users.find(u => u.user_id === selectedUserIds[0]);
    if (!user) return;

    setModalMode("edit");
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

  const handleOpenCreate = () => {
    setModalMode("create");
    setFormData({
        user_id: "", first_name: "", last_name: "", email: "", role_id: "", pos_id: "", dept_id: "", team_id: "", supervisor_id: "", manager_id: "", account_status: "ACTIVE", password: "",
        hire_date: new Date().toISOString().split('T')[0],
        original_hire_date: "", resignation_date: "", original_resignation_date: ""
    });
    setShowModal(true);
  };

  const handleDeleteClick = () => {
    if (selectedUserIds.length !== 1) return;
    setShowDeleteConfirm(true); 
  };

  const executeDelete = async () => {
    setShowDeleteConfirm(false); 
    const userIdToDelete = selectedUserIds[0];

    try {
        const res = await fetch(`/api/admin/users/delete?user_id=${userIdToDelete}`, {
            method: "DELETE",
        });

        const data = await res.json();

        if (res.ok) {
            setUsers(prev => prev.filter(u => u.user_id !== userIdToDelete));
            setSelectedUserIds([]); 
            
            setResultMessage({
                title: "User Deactivated",
                text: "The user has been successfully deactivated and removed from the list.",
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
                text: "User records updated successfully.",
                type: "success"
            });
            setShowResultModal(true);
        } else {
            setResultMessage({
                title: "Update Failed",
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

  // UI STYLES
  const darkSelectStyle = {
      backgroundColor: '#333',
      color: '#fff',
      border: '1px solid #555',
      padding: '8px',
      borderRadius: '4px'
  };

  // For the search/filter inputs to match the dark theme
  const darkInputStyle = {
      backgroundColor: '#222',
      color: '#fff',
      border: '1px solid #444',
      padding: '10px',
      borderRadius: '6px',
      minWidth: '200px'
  };

  return (
    <div className="user-management-section">
      <div className="glass-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="section-title" style={{margin:0}}>User Management</div>
            <div style={{display:'flex', gap:'10px'}}>
                <button 
                    className="btn-action" 
                    onClick={handleDeleteClick}
                    disabled={selectedUserIds.length !== 1}
                    style={{
                        opacity: selectedUserIds.length !== 1 ? 0.5 : 1, 
                        cursor: selectedUserIds.length !== 1 ? 'not-allowed' : 'pointer',
                        background: '#ef4444', 
                        color: 'white'
                    }}
                >
                    Delete User
                </button>

                <button 
                    className="btn-action" 
                    onClick={handleOpenEdit}
                    disabled={selectedUserIds.length !== 1}
                    style={{
                        opacity: selectedUserIds.length !== 1 ? 0.5 : 1, 
                        cursor: selectedUserIds.length !== 1 ? 'not-allowed' : 'pointer',
                        background: 'var(--color-primary)'
                    }}
                >
                    Edit User
                </button>

                <button className="btn-add admin-btn" onClick={handleOpenCreate}>
                    + Add User
                </button>
            </div>
        </div>
      </div>

      {/* --- RESTORED SEARCH & FILTER BAR --- */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search users (ID, Name, Dept, Role)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...darkInputStyle, flex: 1 }}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={darkSelectStyle}
          >
            <option value="">All Roles</option>
            {metadata?.roles?.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={darkSelectStyle}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
      </div>
      {/* ---------------------------------- */}

      <div className="glass-card">
        <div className="table-container" style={{ maxHeight: "600px", overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: '40px'}}></th> 
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Team</th>
                <th>Position</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
                {users.map(user => (
                    <tr key={user.user_id} className={selectedUserIds.includes(user.user_id) ? 'selected-row' : ''}>
                        <td>
                            <input 
                                type="checkbox" 
                                checked={selectedUserIds.includes(user.user_id)} 
                                onChange={() => handleSelectUser(user.user_id)} 
                            />
                        </td>
                        <td style={{fontFamily:'var(--font-mono)'}}>{user.user_id}</td>
                        <td style={{fontWeight:600}}>{user.first_name} {user.last_name}</td>
                        <td>{user.email}</td>
                        <td>{user.D_tblrole?.role_name || "—"}</td>
                        <td>{user.D_tbldepartment?.dept_name || "—"}</td>
                        <td>{user.D_tblteam?.team_name || "—"}</td>
                        <td>{user.D_tblposition?.pos_name || "—"}</td>
                        <td>
                            <span className={`status-badge-admin ${user.account_status === "ACTIVE" ? "active" : "disabled"}`}>
                                {user.account_status}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT FORM MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{zIndex: 1000}}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{
              width: "800px", maxWidth: "95vw", background: "#1a1a1a", border: "1px solid #333", color: "#eee"
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <div className="modal-title" style={{textTransform:'uppercase', letterSpacing:'1px'}}>
                    {modalMode === "create" ? "Add New Employee" : "Employee Details"}
                </div>
                <div style={{color:'#666'}}>{formData.user_id}</div>
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

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                    <div>
                        <label className="label-sm">Account Status</label>
                        <select className="select" style={darkSelectStyle} value={formData.account_status} onChange={e => setFormData({...formData, account_status: e.target.value})}>
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Disabled</option>
                            <option value="DEACTIVATED">Deactivated</option>
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

                <div style={{marginBottom:'15px'}}>
                    <label className="label-sm">Email Address</label>
                    <input type="email" className="modal-input" value={formData.email} onChange={e => setFormData({...formData, email: sanitizeInput(e.target.value, 'email')})} required />
                </div>
                
                {modalMode === "create" && (
                    <div style={{marginBottom:'15px'}}>
                        <label className="label-sm">Initial Password</label>
                        <input type="password" className="modal-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    </div>
                )}

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

                <div style={{background:'#222', padding:'15px', borderRadius:'8px', border:'1px solid #333'}}>
                    <div style={{color:'#ef4444', fontSize:'0.75rem', fontWeight:'bold', marginBottom:'10px', textTransform:'uppercase'}}>Employment History</div>
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'10px'}}>
                        <div>
                            <label className="label-sm">Original Hire Date</label>
                            <input type="date" className="modal-input" value={formData.original_hire_date} onChange={e => setFormData({...formData, original_hire_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="label-sm">Re-Hire Date</label>
                            <input type="text" className="modal-input" disabled placeholder="Pending logic..." />
                        </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'10px'}}>
                        <div>
                            <label className="label-sm">Orig. Resignation</label>
                            <input type="date" className="modal-input" value={formData.original_resignation_date} onChange={e => setFormData({...formData, original_resignation_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="label-sm">Current Resignation</label>
                            <input type="date" className="modal-input" value={formData.resignation_date} onChange={e => setFormData({...formData, resignation_date: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="label-sm">System Entry Date</label>
                        <input type="date" className="modal-input" value={formData.hire_date} onChange={e => setFormData({...formData, hire_date: e.target.value})} />
                    </div>
                </div>

                <div className="modal-actions" style={{marginTop:'20px', justifyContent:'flex-end'}}>
                    <button type="button" className="modal-btn ghost" onClick={() => setShowModal(false)}>CLOSE</button>
                    <button type="submit" className="modal-btn ok" style={{background:'#eee', color:'#000', fontWeight:'bold'}}>SAVE CHANGES</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: '1px solid #444'}}>
                <h3 style={{marginBottom:'1rem', color:'#fff'}}>Confirm Updates</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>Are you sure you want to apply these changes to the database?</p>
                <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
                    <button className="btn-action" onClick={() => setShowConfirmModal(false)} style={{background: '#444'}}>
                        No, Go Back
                    </button>
                    <button className="btn-action" onClick={executeSave} style={{background: 'var(--color-go)'}}>
                        Yes, Update
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)'}}>
            <div className="glass-card" style={{width: '350px', textAlign: 'center', border: '1px solid #ef4444'}}>
                <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⚠️</div>
                <h3 style={{marginBottom:'1rem', color:'#fff'}}>Deactivate User?</h3>
                <p style={{marginBottom:'2rem', color:'#aaa'}}>
                    Are you sure you want to deactivate <b style={{color: '#fff'}}>{selectedUserIds[0]}</b>?
                    <br/><br/>
                    They will be removed from this list immediately.
                </p>
                <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
                    <button className="btn-action" onClick={() => setShowDeleteConfirm(false)} style={{background: '#444'}}>Cancel</button>
                    <button className="btn-action" onClick={executeDelete} style={{background: '#ef4444', color: 'white'}}>Yes, Deactivate</button>
                </div>
            </div>
        </div>
      )}

      {/* RESULT MODAL */}
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
                        background: resultMessage.type === 'success' ? 'var(--color-go)' : '#ef4444', 
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