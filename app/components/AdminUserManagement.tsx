"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, UserCheck, ShieldAlert } from "lucide-react";

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

export default function AdminUserManagement({ lightMode = false }: { lightMode?: boolean }) {
    const [users, setUsers] = useState<User[]>([]);
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [loading, setLoading] = useState(true);

    const [targetUserId, setTargetUserId] = useState<string | null>(null);

    // NEW: Track the currently logged-in admin's user ID
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<"ACTIVE" | "DISABLED" | "DEACTIVATED">("ACTIVE");
    const [stats, setStats] = useState({ total: 0, active: 0, disabled: 0 });

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [showModal, setShowModal] = useState(false);
    const [drawerClosing, setDrawerClosing] = useState(false);

    // Confirmation Modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
    const [showEnableConfirm, setShowEnableConfirm] = useState(false);
    const [userToEnable, setUserToEnable] = useState<User | null>(null);

    const [showResultModal, setShowResultModal] = useState(false);

    const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
    const [resultMessage, setResultMessage] = useState({ title: "", text: "", type: "success" });

    const [isProcessing, setIsProcessing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        user_id: "", first_name: "", last_name: "", email: "", role_id: "", pos_id: "", dept_id: "", team_id: "", supervisor_id: "", manager_id: "", account_status: "ACTIVE", password: "",
        hire_date: "", original_hire_date: "", resignation_date: "", original_resignation_date: ""
    });

    const closeDrawer = () => {
        setDrawerClosing(true);
        setTimeout(() => {
            setShowModal(false);
            setDrawerClosing(false);
        }, 300);
    };

    useEffect(() => {
        fetch("/api/admin/metadata")
            .then(res => {
                if (!res.ok) throw new Error("Metadata fetch failed");
                return res.json();
            })
            .then(setMetadata)
            .catch(err => console.error("Metadata Error:", err));
    }, []);

    const loadUsers = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            // First, establish who is logged in if we don't know already
            let meId = currentUserId;
            if (!meId) {
                const meRes = await fetch("/api/auth/me", { signal });
                if (meRes.ok) {
                    const meData = await meRes.json();
                    if (meData && meData.user_id) {
                        meId = meData.user_id;
                        setCurrentUserId(meId);
                    }
                }
            }

            const params = new URLSearchParams({
                limit: "1000",
                search: search,
                role: roleFilter,
            });

            if (activeTab === "ACTIVE") {
                params.append("status_exclude", "DEACTIVATED");
                if (statusFilter) params.append("status", statusFilter);
            } else if (activeTab === "DISABLED") {
                params.append("status", "DISABLED");
            } else {
                params.append("status", "DEACTIVATED");
            }

            const res = await fetch(`/api/admin/users/list?${params}`, { signal });
            const data = await res.json();

            if (res.ok) {
                let fetchedUsers = data.users || [];

                // Exclude the currently logged-in user
                if (meId) {
                    fetchedUsers = fetchedUsers.filter((u: User) => u.user_id !== meId);
                }

                if (activeTab === "ACTIVE") {
                    fetchedUsers = fetchedUsers.filter((u: User) => u.account_status !== "DISABLED" && u.account_status !== "DEACTIVATED");
                }

                setUsers(fetchedUsers);

                if (!search && !roleFilter && !statusFilter) {
                    const statRes = await fetch(`/api/admin/users/list?limit=5000`, { signal });
                    const statData = await statRes.json();
                    if (statRes.ok) {
                        let allUsers = statData.users || [];

                        // Also exclude current user from the HUD stats calculations
                        if (meId) {
                            allUsers = allUsers.filter((u: User) => u.user_id !== meId);
                        }

                        setStats({
                            total: allUsers.length,
                            active: allUsers.filter((u: User) => u.account_status === "ACTIVE" || !u.account_status).length,
                            disabled: allUsers.filter((u: User) => u.account_status === "DISABLED").length
                        });
                    }
                }
            }
        } catch (e: any) {
            if (e.name === "AbortError") return;
            console.error(e);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        const controller = new AbortController();
        loadUsers(controller.signal);
        return () => controller.abort();
    }, [search, roleFilter, statusFilter, activeTab]);

    const sanitizeInput = (value: string, type: 'text' | 'email' | 'userid') => {
        if (!value) return "";
        switch (type) {
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

    const promptEnableUser = (user: User) => {
        setUserToEnable(user);
        setShowEnableConfirm(true);
    };

    const executeEnable = async () => {
        if (!userToEnable) return;
        setIsProcessing(true);
        try {
            const res = await fetch("/api/admin/users/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userToEnable.user_id, account_status: "ACTIVE" })
            });
            const data = await res.json();
            setIsProcessing(false);
            setShowEnableConfirm(false);
            setUserToEnable(null);

            if (res.ok) {
                loadUsers();
                setResultMessage({ title: "Account Enabled", text: "The user account has been successfully unlocked and enabled.", type: "success" });
                setShowResultModal(true);
            } else {
                setResultMessage({ title: "Action Failed", text: data.message || "Could not enable user.", type: "error" });
                setShowResultModal(true);
            }
        } catch (err) {
            setIsProcessing(false);
            setShowEnableConfirm(false);
            setResultMessage({ title: "System Error", text: "Failed to connect to the server.", type: "error" });
            setShowResultModal(true);
        }
    };

    const executeDelete = async () => {
        if (!targetUserId) return;
        setIsProcessing(true);

        try {
            const res = await fetch(`/api/admin/users/delete?user_id=${targetUserId}`, {
                method: "DELETE",
            });

            const data = await res.json();
            setIsProcessing(false);
            setShowDeleteConfirm(false);

            if (res.ok) {
                setUsers(prev => prev.filter(u => u.user_id !== targetUserId));
                setTargetUserId(null);
                closeDrawer();

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
        setIsProcessing(true);

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
            setIsProcessing(false);
            setShowReactivateConfirm(false);

            if (res.ok) {
                closeDrawer();
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
        setIsProcessing(true);

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
            setIsProcessing(false);
            setShowConfirmModal(false);

            if (res.ok) {
                closeDrawer();
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

    const isDeactivated = modalMode === "edit" && formData.account_status === "DEACTIVATED";

    const stickyHeaderStyle = {
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-panel, #262626)',
        color: 'var(--text-main, #fff)',
        zIndex: 10,
        boxShadow: '0 1px 0px var(--border-subtle, #333)',
        transition: 'all 0.45s ease'
    } as React.CSSProperties;

    const totalPages = Math.max(1, Math.ceil(users.length / itemsPerPage));
    const indexOfLastUser = currentPage * itemsPerPage;
    const indexOfFirstUser = indexOfLastUser - itemsPerPage;
    const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

    return (
        <div className="user-management-section">

            <div className="hud-row" style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem" }}>
                <div className="hud-card animate-slide-up" style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '4px solid #3b82f6', animationDelay: '0s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div className="hud-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #888)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                            Total Users
                        </div>
                        <Users size={20} color="#3b82f6" opacity={0.8} />
                    </div>
                    <div className="hud-val" style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main, #fff)', lineHeight: 1, margin: 0 }}>
                        {stats.total}
                    </div>
                </div>

                <div className="hud-card animate-slide-up" style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '4px solid var(--color-go, #46e38a)', animationDelay: '0.1s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div className="hud-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #888)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                            Active Users
                        </div>
                        <UserCheck size={20} color="var(--color-go, #46e38a)" opacity={0.8} />
                    </div>
                    <div className="hud-val" style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main, #fff)', lineHeight: 1, margin: 0 }}>
                        {stats.active}
                    </div>
                </div>

                <div className="hud-card animate-slide-up" style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '4px solid #f59e0b', animationDelay: '0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div className="hud-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #888)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                            Disabled Users
                        </div>
                        <ShieldAlert size={20} color="#f59e0b" opacity={0.8} />
                    </div>
                    <div className="hud-val" style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main, #fff)', lineHeight: 1, margin: 0 }}>
                        {stats.disabled}
                    </div>
                </div>
            </div>

            <div className="glass-card animate-slide-up" style={{ marginBottom: "1.5rem", padding: "1rem", animationDelay: '0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '1rem' }}>
                    <div className="section-title" style={{ margin: 0, whiteSpace: 'nowrap' }}>User Management</div>

                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="select"
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                width: '160px',
                                flex: 'none'
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
                                className="select"
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    width: '160px',
                                    flex: 'none'
                                }}
                            >
                                <option value="">All Statuses</option>
                                <option value="ACTIVE">Active Only</option>
                            </select>
                        )}

                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="modal-input"
                            style={{
                                padding: '8px 12px',
                                width: '220px',
                                flex: 'none'
                            }}
                        />

                        {activeTab === "ACTIVE" && (
                            <button
                                onClick={handleOpenCreate}
                                style={{
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    flex: 'none'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                            >
                                + Add User
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="glass-card animate-slide-up" style={{ animationDelay: '0.3s' }}>

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
                        onClick={() => { setActiveTab("DISABLED"); setStatusFilter(""); }}
                        style={{
                            flex: 1,
                            padding: "1rem",
                            backgroundColor: "transparent",
                            borderTopWidth: 0,
                            borderLeftWidth: 0,
                            borderRightWidth: 0,
                            borderBottom: activeTab === "DISABLED" ? "3px solid #f59e0b" : "3px solid transparent",
                            color: activeTab === "DISABLED" ? "#f59e0b" : "#aaa",
                            fontWeight: 800,
                            fontSize: "1rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            textTransform: "uppercase",
                            letterSpacing: "1px"
                        }}
                    >
                        Disabled
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
                        Deactivated
                    </button>
                </div>

                <div className="table-container" style={{ overflowX: "auto" }}>
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
                            {!loading && currentUsers.length > 0 && currentUsers.map((user, index) => (
                                <tr key={user.user_id} className="animate-slide-up" style={{ animationDelay: `${0.35 + (index * 0.05)}s` }}>
                                    <td style={{ fontWeight: 600 }}>{user.first_name} {user.last_name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.D_tblrole?.role_name || "—"}</td>
                                    <td>{user.D_tbldepartment?.dept_name || "—"}</td>
                                    <td>{user.D_tblteam?.team_name || "—"}</td>
                                    <td>{user.D_tblposition?.pos_name || "—"}</td>
                                    <td>
                                        <span className={`status-badge-admin ${user.account_status === "ACTIVE" ? "active" : user.account_status === "DISABLED" ? "disabled" : "disabled"}`}>
                                            {user.account_status || "NULL"}
                                        </span>
                                    </td>
                                    <td>
                                        {activeTab === "DISABLED" ? (
                                            <button
                                                className="btn-mini"
                                                onClick={() => promptEnableUser(user)}
                                                disabled={isProcessing}
                                                style={{
                                                    backgroundColor: '#46e38a',
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
                                                Enable
                                            </button>
                                        ) : (
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
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && users.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: 'var(--bg-panel, rgba(255,255,255,0.02))',
                        borderRadius: '8px',
                        transition: 'background 0.45s ease'
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
                )}

            </div>

            {showModal && createPortal(
                <div className={`drawer-overlay${drawerClosing ? ' closing' : ''}${lightMode ? ' light-mode' : ''}`} style={{ zIndex: 99999 }} onClick={closeDrawer}>
                    <div className="drawer-panel" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="drawer-title">
                                {modalMode === "create" ? "Add New Employee" : "Employee Details"}
                            </div>
                            <button className="drawer-close" onClick={closeDrawer}>
                                ✕
                            </button>
                        </div>

                        <div className="drawer-body">
                            <form id="admin-user-form" onSubmit={handlePreSubmit}>
                                <div style={{ display: 'grid', gap: '24px' }}>

                                    <div style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}>
                                        <div style={{ color: 'var(--accent-admin, #3b82f6)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Personal Information</div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label className="label-sm">First Name</label>
                                                <input type="text" className="modal-input" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: sanitizeInput(e.target.value, 'text') })} required />
                                            </div>
                                            <div>
                                                <label className="label-sm">Last Name</label>
                                                <input type="text" className="modal-input" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: sanitizeInput(e.target.value, 'text') })} required />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: modalMode === 'create' ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: modalMode === 'create' ? '16px' : '0' }}>
                                            <div>
                                                <label className="label-sm">Email Address</label>
                                                <input type="email" className="modal-input" value={formData.email} onChange={e => setFormData({ ...formData, email: sanitizeInput(e.target.value, 'email') })} required />
                                            </div>
                                            {modalMode === "create" && (
                                                <div>
                                                    <label className="label-sm">User ID (Required)</label>
                                                    <input type="text" className="modal-input" value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: sanitizeInput(e.target.value, 'userid') })} required />
                                                </div>
                                            )}
                                        </div>

                                        {modalMode === "create" && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                                <div>
                                                    <label className="label-sm">Initial Password</label>
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            className="modal-input"
                                                            value={formData.password}
                                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                                                                color: 'var(--text-muted, #aaa)',
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
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}>
                                        <div style={{ color: 'var(--accent-admin, #3b82f6)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Organization & Role</div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label className="label-sm">Department</label>
                                                <select className="select" value={formData.dept_id} onChange={e => setFormData({ ...formData, dept_id: e.target.value })} required>
                                                    <option value="">Select Department</option>
                                                    {metadata?.departments?.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label-sm">Position</label>
                                                <select className="select" value={formData.pos_id} onChange={e => setFormData({ ...formData, pos_id: e.target.value })} required>
                                                    <option value="">Select Position</option>
                                                    {metadata?.positions?.map(p => <option key={p.pos_id} value={p.pos_id}>{p.pos_name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label className="label-sm">Role</label>
                                                <select className="select" value={formData.role_id} onChange={e => setFormData({ ...formData, role_id: e.target.value })} required>
                                                    <option value="">Select Role</option>
                                                    {metadata?.roles?.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label-sm">Account Status</label>
                                                <div style={{
                                                    padding: '8px 12px',
                                                    color: formData.account_status === 'ACTIVE' ? 'var(--color-go, #46e38a)' : (formData.account_status === 'DEACTIVATED' ? '#ef4444' : '#f59e0b'),
                                                    fontWeight: 800,
                                                    letterSpacing: '1px',
                                                    backgroundColor: 'var(--bg-input, rgba(0,0,0,0.1))',
                                                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
                                                    borderRadius: '6px',
                                                    height: '42px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {formData.account_status}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label className="label-sm">Manager</label>
                                                <select className="select" value={formData.manager_id} onChange={e => setFormData({ ...formData, manager_id: e.target.value })}>
                                                    <option value="">N/A</option>
                                                    {metadata?.managers?.map(m => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label-sm">Supervisor</label>
                                                <select className="select" value={formData.supervisor_id} onChange={e => setFormData({ ...formData, supervisor_id: e.target.value })}>
                                                    <option value="">N/A</option>
                                                    {metadata?.supervisors?.map(s => <option key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}>
                                        <div style={{ color: 'var(--accent-admin, #3b82f6)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Employment History</div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label className="label-sm">Original Hire Date</label>
                                                <input
                                                    type="date"
                                                    className="modal-input"
                                                    value={formData.original_hire_date}
                                                    onChange={e => setFormData({ ...formData, original_hire_date: e.target.value })}
                                                    disabled
                                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                                />
                                            </div>
                                            <div>
                                                <label className="label-sm">Orig. Resignation</label>
                                                <input
                                                    type="date"
                                                    className="modal-input"
                                                    value={formData.original_resignation_date}
                                                    onChange={e => setFormData({ ...formData, original_resignation_date: e.target.value })}
                                                    disabled
                                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label className="label-sm">System Entry</label>
                                                <input
                                                    type="date"
                                                    className="modal-input"
                                                    value={formData.hire_date}
                                                    onChange={e => setFormData({ ...formData, hire_date: e.target.value })}
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
                                                    onChange={e => setFormData({ ...formData, resignation_date: e.target.value })}
                                                    disabled
                                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label className="label-sm">Re-Hire Record (Memo)</label>
                                                <input
                                                    type="text"
                                                    className="modal-input"
                                                    disabled
                                                    placeholder="Pending logic..."
                                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {modalMode === "edit" && (
                                    <div className="danger-zone" style={{
                                        marginTop: '24px',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        border: isDeactivated ? '1px solid rgba(70, 227, 138, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)',
                                        background: isDeactivated ? 'rgba(70, 227, 138, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '1rem' }}>{isDeactivated ? '🔄' : '⚠️'}</span>
                                            <span style={{
                                                fontWeight: 900,
                                                fontSize: '0.75rem',
                                                letterSpacing: '0.12em',
                                                textTransform: 'uppercase' as const,
                                                color: isDeactivated ? 'var(--color-go, #46e38a)' : '#ef4444',
                                            }}>
                                                {isDeactivated ? 'Recovery Zone' : 'Danger Zone'}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: '0.82rem',
                                            opacity: 0.7,
                                            lineHeight: 1.5,
                                            marginBottom: '14px',
                                        }}>
                                            {isDeactivated
                                                ? 'This user is currently deactivated. Reactivating will restore their access and return them to the active list.'
                                                : 'Deactivating this user will revoke all access and remove them from the active employee list. This action can be reversed.'}
                                        </p>
                                        {!isDeactivated ? (
                                            <button
                                                type="button"
                                                className="modal-btn danger"
                                                style={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 'bold', width: '100%' }}
                                                onClick={() => setShowDeleteConfirm(true)}
                                            >
                                                DEACTIVATE USER
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="modal-btn ok"
                                                style={{ backgroundColor: 'var(--color-go)', color: '#fff', fontWeight: 'bold', width: '100%' }}
                                                onClick={() => setShowReactivateConfirm(true)}
                                            >
                                                REACTIVATE USER
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="modal-actions" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <button type="button" className="modal-btn ghost" onClick={closeDrawer}>CLOSE</button>
                                    <button type="submit" className="modal-btn ok" style={{ backgroundColor: 'var(--text-main, #eee)', color: 'var(--bg-panel, #000)', fontWeight: 'bold' }}>SAVE CHANGES</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* CONFIRMATION MODALS */}
            {
                showConfirmModal && createPortal(
                    <div className="modal-overlay" style={{ zIndex: 100000, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)' }}>
                        <div style={{
                            width: '400px',
                            borderRadius: '20px',
                            padding: '36px 32px 28px',
                            textAlign: 'center',
                            background: lightMode ? '#ffffff' : '#1a1e26',
                            border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: lightMode ? '0 20px 60px rgba(0,0,0,0.15)' : '0 20px 60px rgba(0,0,0,0.6)',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: lightMode ? 'rgba(91, 99, 255, 0.1)' : 'rgba(91, 99, 255, 0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px', fontSize: '1.6rem',
                            }}>💾</div>
                            <h3 style={{
                                marginBottom: '10px', fontSize: '1.15rem', fontWeight: 900,
                                letterSpacing: '0.04em',
                                color: lightMode ? '#1a1a2e' : '#fff',
                            }}>Confirm Updates</h3>
                            <p style={{
                                marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.6,
                                color: lightMode ? '#666' : 'rgba(255,255,255,0.55)',
                            }}>Are you sure you want to apply these changes to the database?</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={executeSave} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px', border: 'none',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#46e38a', color: '#fff',
                                    fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    boxShadow: '0 4px 14px rgba(70, 227, 138, 0.3)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    {isProcessing && (
                                        <svg style={{ animation: 'spin 1s linear infinite', height: '1.2rem', width: '1.2rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isProcessing ? "Processing..." : `Yes, ${modalMode === 'create' ? 'Create' : 'Update'}`}
                                </button>
                                <button onClick={() => !isProcessing && setShowConfirmModal(false)} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.12)',
                                    color: lightMode ? '#555' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    opacity: isProcessing ? 0.5 : 1,
                                }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }

            {
                showDeleteConfirm && createPortal(
                    <div className="modal-overlay" style={{ zIndex: 100000, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)' }}>
                        <div style={{
                            width: '400px',
                            borderRadius: '20px',
                            padding: '36px 32px 28px',
                            textAlign: 'center',
                            background: lightMode ? '#ffffff' : '#1a1e26',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            boxShadow: lightMode ? '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.1)' : '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(239,68,68,0.08)',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: lightMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px', fontSize: '1.6rem',
                            }}>⚠️</div>
                            <h3 style={{
                                marginBottom: '10px', fontSize: '1.15rem', fontWeight: 900,
                                letterSpacing: '0.04em',
                                color: lightMode ? '#1a1a2e' : '#fff',
                            }}>Deactivate User?</h3>
                            <p style={{
                                marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.6,
                                color: lightMode ? '#666' : 'rgba(255,255,255,0.55)',
                            }}>
                                Are you sure you want to deactivate this user?
                                They will be removed from the active list immediately.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={executeDelete} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px', border: 'none',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#ef4444', color: '#fff',
                                    fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    {isProcessing && (
                                        <svg style={{ animation: 'spin 1s linear infinite', height: '1.2rem', width: '1.2rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isProcessing ? "Deactivating..." : "Yes, Deactivate"}
                                </button>
                                <button onClick={() => !isProcessing && setShowDeleteConfirm(false)} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.12)',
                                    color: lightMode ? '#555' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    opacity: isProcessing ? 0.5 : 1,
                                }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }

            {
                showReactivateConfirm && createPortal(
                    <div className="modal-overlay" style={{ zIndex: 100000, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)' }}>
                        <div style={{
                            width: '400px',
                            borderRadius: '20px',
                            padding: '36px 32px 28px',
                            textAlign: 'center',
                            background: lightMode ? '#ffffff' : '#1a1e26',
                            border: '1px solid rgba(70, 227, 138, 0.3)',
                            boxShadow: lightMode ? '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(70,227,138,0.1)' : '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(70,227,138,0.08)',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: lightMode ? 'rgba(70, 227, 138, 0.08)' : 'rgba(70, 227, 138, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px', fontSize: '1.6rem',
                            }}>🔄</div>
                            <h3 style={{
                                marginBottom: '10px', fontSize: '1.15rem', fontWeight: 900,
                                letterSpacing: '0.04em',
                                color: lightMode ? '#1a1a2e' : '#fff',
                            }}>Reactivate User?</h3>
                            <p style={{
                                marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.6,
                                color: lightMode ? '#666' : 'rgba(255,255,255,0.55)',
                            }}>
                                Are you sure you want to reactivate this user?
                                They will immediately regain access to the system.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={executeReactivate} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px', border: 'none',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#46e38a', color: '#fff',
                                    fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    boxShadow: '0 4px 14px rgba(70, 227, 138, 0.3)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    {isProcessing && (
                                        <svg style={{ animation: 'spin 1s linear infinite', height: '1.2rem', width: '1.2rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isProcessing ? "Reactivating..." : "Yes, Reactivate"}
                                </button>
                                <button onClick={() => !isProcessing && setShowReactivateConfirm(false)} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.12)',
                                    color: lightMode ? '#555' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    opacity: isProcessing ? 0.5 : 1,
                                }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }

            {/* ENABLE CONFIRMATION MODAL */}
            {
                showEnableConfirm && userToEnable && createPortal(
                    <div className="modal-overlay" style={{ zIndex: 100000, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)' }}>
                        <div style={{
                            width: '400px',
                            borderRadius: '20px',
                            padding: '36px 32px 28px',
                            textAlign: 'center',
                            background: lightMode ? '#ffffff' : '#1a1e26',
                            border: '1px solid rgba(70, 227, 138, 0.3)',
                            boxShadow: lightMode ? '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(70,227,138,0.1)' : '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(70,227,138,0.08)',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: lightMode ? 'rgba(70, 227, 138, 0.08)' : 'rgba(70, 227, 138, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px', fontSize: '1.6rem',
                            }}>🔓</div>
                            <h3 style={{
                                marginBottom: '10px', fontSize: '1.15rem', fontWeight: 900,
                                letterSpacing: '0.04em',
                                color: lightMode ? '#1a1a2e' : '#fff',
                            }}>Enable Account?</h3>
                            <p style={{
                                marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.6,
                                color: lightMode ? '#666' : 'rgba(255,255,255,0.55)',
                            }}>
                                Are you sure you want to enable <strong>{userToEnable.first_name} {userToEnable.last_name}</strong>'s account?
                                This will reset their failed login attempts and restore their access.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={executeEnable} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px', border: 'none',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#46e38a', color: '#fff',
                                    fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    boxShadow: '0 4px 14px rgba(70, 227, 138, 0.3)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    {isProcessing && (
                                        <svg style={{ animation: 'spin 1s linear infinite', height: '1.2rem', width: '1.2rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isProcessing ? "Enabling..." : "Yes, Enable Account"}
                                </button>
                                <button onClick={() => !isProcessing && setShowEnableConfirm(false)} disabled={isProcessing} style={{
                                    padding: '14px', borderRadius: '12px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.12)',
                                    color: lightMode ? '#555' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    opacity: isProcessing ? 0.5 : 1,
                                }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }

            {/* RESULTS MODAL */}
            {
                showResultModal && createPortal(
                    <div className="modal-overlay" style={{ zIndex: 100000, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)' }}>
                        <div style={{
                            width: '400px',
                            borderRadius: '20px',
                            padding: '36px 32px 28px',
                            textAlign: 'center',
                            background: lightMode ? '#ffffff' : '#1a1e26',
                            border: resultMessage.type === 'success'
                                ? (lightMode ? '1px solid rgba(70, 227, 138, 0.4)' : '1px solid rgba(70, 227, 138, 0.3)')
                                : (lightMode ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)'),
                            boxShadow: resultMessage.type === 'success'
                                ? (lightMode ? '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(70,227,138,0.1)' : '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(70,227,138,0.08)')
                                : (lightMode ? '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.1)' : '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(239,68,68,0.08)'),
                        }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%',
                                background: resultMessage.type === 'success'
                                    ? (lightMode ? 'rgba(70, 227, 138, 0.1)' : 'rgba(70, 227, 138, 0.15)')
                                    : (lightMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.12)'),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px', fontSize: '2rem',
                            }}>
                                {resultMessage.type === 'success' ? '✅' : '❌'}
                            </div>
                            <h3 style={{
                                marginBottom: '10px', fontSize: '1.2rem', fontWeight: 900,
                                letterSpacing: '0.04em',
                                color: lightMode ? '#1a1a2e' : '#fff',
                            }}>{resultMessage.title}</h3>
                            <p style={{
                                marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.6,
                                color: lightMode ? '#666' : 'rgba(255,255,255,0.55)',
                            }}>{resultMessage.text}</p>
                            <button
                                onClick={() => setShowResultModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                    backgroundColor: resultMessage.type === 'success' ? '#46e38a' : '#ef4444',
                                    color: '#fff',
                                    fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                                    boxShadow: resultMessage.type === 'success' ? '0 4px 14px rgba(70, 227, 138, 0.3)' : '0 4px 14px rgba(239, 68, 68, 0.3)',
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                    , document.body)
            }
        </div >
    );
}