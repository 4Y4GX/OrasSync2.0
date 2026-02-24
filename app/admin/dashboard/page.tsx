'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import AdminUserManagement from '../../components/AdminUserManagement';
import ExcelImportExport from '../../components/ExcelImportExport';
import AnalyticsView from '../../components/AnalyticsView';

const THEME_KEY = 'orasync_theme';

// --- PASSWORD VALIDATION LOGIC ---
const STRONG_PASS_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@?_\-])[A-Za-z\d!@?_\-]{15,20}$/;

function passwordChecks(pw: string) {
  const lengthOk = pw.length >= 15 && pw.length <= 20;
  const upperOk = /[A-Z]/.test(pw);
  const lowerOk = /[a-z]/.test(pw);
  const numberOk = /\d/.test(pw);
  const symbolOk = /[!@?_\-]/.test(pw);
  const onlyAllowed = /^[A-Za-z\d!@?_\-]*$/.test(pw);
  return { lengthOk, upperOk, lowerOk, numberOk, symbolOk, onlyAllowed, strongOk: lengthOk && upperOk && lowerOk && numberOk && symbolOk && onlyAllowed };
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('users');
  const [lightMode, setLightMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Admin Data State
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // Email states for Password Change
  const [adminEmailInput, setAdminEmailInput] = useState('');

  // Dropdown and Modals
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Password Change Flow States
  const [pwStep, setPwStep] = useState(0);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [secQuestion, setSecQuestion] = useState({ id: null, text: "" });
  const [secAnswer, setSecAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const pwValidation = useMemo(() => passwordChecks(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light') {
        setLightMode(true);
      } else if (saved === 'dark') {
        setLightMode(false);
      } else {
        const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches ?? false;
        setLightMode(prefersLight);
      }
    } catch { /* ignore */ } finally {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(THEME_KEY, lightMode ? 'light' : 'dark');
    } catch { /* ignore */ }
  }, [lightMode, mounted]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        if (data && data.first_name) {
          const fullName = `${data.first_name} ${data.last_name || ''}`.trim();
          setAdminName(fullName);
          
          // Pre-fill email if available from the token
          if (data.email) {
             setAdminEmailInput(data.email);
          }

          const firstInit = data.first_name.charAt(0).toUpperCase();
          const lastInit = data.last_name ? data.last_name.charAt(0).toUpperCase() : '';
          setAdminInitials(`${firstInit}${lastInit}`);
        } else {
          setAdminName('Admin User');
        }
      })
      .catch(err => {
        console.error('Failed to fetch admin profile:', err);
        setAdminName('Admin User');
      });
  }, []);

  const doLogout = useCallback(async () => {
    try {
      setActionBusy(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
    } finally {
      setActionBusy(false);
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const wrap = profileMenuWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setProfileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  // --- PASSWORD CHANGE HANDLERS ---
  const handleStartPasswordChange = async () => {
      if (!adminEmailInput.trim()) {
          setPwError("Please enter your email address.");
          return;
      }

      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/otp/generate', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              // Using the explicitly entered/confirmed email
              body: JSON.stringify({ email: adminEmailInput.trim() }) 
          });
          if (res.ok) { setPwStep(1); setOtp(["", "", "", "", "", ""]); } 
          else { setPwError("Failed to send OTP. Check your email address."); }
      } catch (e) { setPwError("Connection error."); } 
      finally { setPwLoading(false); }
  };

  const handleVerifyOtp = async () => {
      const code = otp.join("");
      if (code.length < 6) return;
      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/otp/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: adminEmailInput.trim(), otp: code, flow: "recovery" })
          });
          if (res.ok) {
              const qRes = await fetch('/api/manager/security-questions'); 
              if (qRes.ok) {
                  const qData = await qRes.json();
                  setSecQuestion({ id: qData.questionId, text: qData.questionText });
                  setPwStep(2);
              } else { 
                  const errData = await qRes.json().catch(()=>({}));
                  setPwError(errData.message || "Failed to load security question."); 
              }
          } else { setPwError("Invalid or expired OTP."); setOtp(["", "", "", "", "", ""]); }
      } catch (e) { setPwError("Verification failed."); } 
      finally { setPwLoading(false); }
  };

  const handleAnswerQuestion = async () => {
      if (!secAnswer.trim()) { setPwError("Please provide an answer."); return; }
      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/security-question', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionId: secQuestion.id, answer: secAnswer.trim() })
          });
          if (res.ok) { setPwStep(3); } 
          else { setPwError("Incorrect answer."); }
      } catch (e) { setPwError("Verification failed."); } 
      finally { setPwLoading(false); }
  };

  const handleResetPassword = async () => {
      if (!pwValidation.strongOk || !passwordsMatch) return;
      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/reset-password', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ newPassword })
          });
          if (res.ok) { setPwStep(4); } 
          else { setPwError("Failed to update password."); }
      } catch (e) { setPwError("Update failed."); } 
      finally { setPwLoading(false); }
  };

  const resetSettingsState = () => {
      setShowSettingsModal(false);
      setTimeout(() => { 
          setPwStep(0); 
          setPwError(""); 
          setNewPassword(""); 
          setConfirmNewPassword(""); 
          setSecAnswer(""); 
          setShowPw(false);
          setShowConfirmPw(false);
      }, 300);
  };

  if (!mounted) return null;

  return (
    <div className={`dashboard-container admin-theme ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>

      <aside className="info-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="brand-logo">ORASync</div>

        <ul className="nav-links">
          {['users', 'import', 'audit-logs'].map(section => (
            <li
              key={section}
              className={`nav-item ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
              style={{ textTransform: 'uppercase' }}
            >
              {section === 'import' ? 'Import Data' :
                section === 'audit-logs' ? 'Audit Logs' :
                  section.charAt(0).toUpperCase() + section.slice(1)}
            </li>
          ))}
        </ul>

        <div className="widget-box">
          <div className="label-sm">System Status</div>
          <div className="status-badge go">
            <span className="dot"></span>
            OPERATIONAL
          </div>
        </div>

        <div className="profile-menu-wrap" ref={profileMenuWrapRef} style={{ marginTop: 'auto', marginBottom: '1rem', width: '100%' }}>
          {profileMenuOpen && (
            <div className="profile-menu-card" role="menu" aria-label="Profile menu">
              <button
                className="profile-menu-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowSettingsModal(true);
                }}
                type="button"
              >
                <span className="menu-icon" style={{marginRight: '8px'}}>⚙</span>
                <span>Settings</span>
              </button>

              <button
                className="profile-menu-item danger"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowLogoutConfirm(true);
                }}
                type="button"
                disabled={actionBusy}
              >
                <span className="menu-icon" style={{marginRight: '8px'}}>⎋</span>
                <span>Log Out</span>
              </button>
            </div>
          )}

          <button
            className="profile-trigger"
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            style={{ width: '100%', padding: 0, background: 'none', border: 'none', textAlign: 'left' }}
          >
            <div className="profile-card" style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              <div className="avatar" style={{ width: '46px', height: '46px', flexShrink: 0, margin: 0 }}>{adminInitials}</div>
              <div className="profile-info" style={{ textAlign: 'left', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>SYSTEM ADMIN</div>
              </div>
            </div>
          </button>
        </div>

      </aside >

      <main className="workspace-panel">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {activeSection === 'audit-logs' ? 'System Audit Logs' : 'Admin Dashboard'}
          </h1>
        </div>

        <div className="content-area">
          {activeSection === 'users' && (
            <div className="section-view active fade-in">
              <AdminUserManagement lightMode={lightMode} />
            </div>
          )}

          {activeSection === 'import' && (
            <div className="section-view active fade-in">
              <ExcelImportExport />
            </div>
          )}

          {activeSection === 'audit-logs' && (
            <div className="section-view active fade-in">
              <AnalyticsView />
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-card" style={{ maxWidth: '500px', background: lightMode ? '#ffffff' : '#1a1e26', border: lightMode ? '1px solid #d0d2d9' : '1px solid rgba(255,255,255,0.1)', color: lightMode ? '#1a1a2e' : '#fff' }}>
            <div className="modal-header" style={{ padding: '20px 30px', borderBottom: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)' }}>
              <span className="modal-title" style={{ color: '#3b82f6', fontWeight: 800, fontSize: '1.1rem' }}>Settings</span>
              <span onClick={resetSettingsState} style={{ cursor: 'pointer', fontSize: '1.2rem', color: lightMode ? '#666' : '#aaa' }}>✕</span>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '25px', padding: '30px' }}>
              {pwStep === 0 && (
                <>
                  <div>
                      <h4 style={{ color: lightMode ? '#1a1a2e' : '#fff', marginBottom: '10px', borderBottom: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px' }}>Appearance</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: lightMode ? '#f8f9fa' : 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                              <div style={{ fontWeight: 600, color: lightMode ? '#1a1a2e' : '#fff' }}>Theme Mode</div>
                              <div style={{ fontSize: '0.8rem', color: lightMode ? '#666' : 'rgba(255,255,255,0.5)' }}>Toggle between Dark and Light mode.</div>
                          </div>
                          <button 
                              onClick={() => setLightMode(!lightMode)}
                              style={{ 
                                padding: '8px 15px', 
                                color: lightMode ? '#fff' : '#3b82f6', 
                                border: lightMode ? 'none' : '1px solid #3b82f6', 
                                background: lightMode ? '#3b82f6' : 'transparent',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                          >
                              {lightMode ? 'Light Mode' : 'Dark Mode'}
                          </button>
                      </div>
                  </div>

                  <div>
                      <h4 style={{ color: lightMode ? '#1a1a2e' : '#fff', marginBottom: '10px', borderBottom: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px' }}>Security</h4>
                      <div style={{ background: lightMode ? '#f8f9fa' : 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', border: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontWeight: 600, color: lightMode ? '#1a1a2e' : '#fff' }}>Change Password</div>
                          <div style={{ fontSize: '0.8rem', color: lightMode ? '#666' : 'rgba(255,255,255,0.5)' }}>Confirm your email address to receive a verification code.</div>
                          
                          <input 
                              type="email" 
                              placeholder="Admin Email Address" 
                              value={adminEmailInput} 
                              onChange={(e) => setAdminEmailInput(e.target.value)} 
                              style={{ 
                                  width: '100%', padding: '10px', borderRadius: '6px', 
                                  border: lightMode ? '1px solid #ccc' : '1px solid #444', 
                                  background: lightMode ? '#fff' : 'transparent', 
                                  color: lightMode ? '#000' : '#fff', 
                                  marginBottom: '5px' 
                              }}
                          />

                          <button onClick={handleStartPasswordChange} style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: (!adminEmailInput.trim() || pwLoading) ? 'not-allowed' : 'pointer', opacity: (!adminEmailInput.trim() || pwLoading) ? 0.5 : 1 }} disabled={!adminEmailInput.trim() || pwLoading}>
                              {pwLoading ? "Sending..." : "Send Verification Code"}
                          </button>
                          {pwError && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{pwError}</div>}
                      </div>
                  </div>
                </>
              )}

              {/* STEP 1: VERIFY OTP */}
              {pwStep === 1 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <h4 style={{ color: '#3b82f6' }}>Verify Identity</h4>
                      <p style={{ fontSize: '0.85rem', color: lightMode ? '#666' : '#aaa' }}>Enter the 6-digit code sent to your registered contact.</p>
                      
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '15px 0' }}>
                          {otp.map((digit, idx) => (
                              <input 
                                  key={idx} ref={(el) => { otpRefs.current[idx] = el; }}
                                  type="text" inputMode="numeric" maxLength={1} value={digit}
                                  onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, "");
                                      const newOtp = [...otp]; newOtp[idx] = val; setOtp(newOtp);
                                      if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
                                  }}
                                  onKeyDown={(e) => {
                                      if (e.key === "Backspace" && !otp[idx] && idx > 0) {
                                          const newOtp = [...otp]; newOtp[idx - 1] = ""; setOtp(newOtp);
                                          otpRefs.current[idx - 1]?.focus();
                                      }
                                  }}
                                  style={{ width: '45px', height: '55px', textAlign: 'center', fontSize: '1.5rem', background: lightMode ? '#fff' : 'rgba(255,255,255,0.02)', border: lightMode ? '1px solid #ccc' : '1px solid #444', color: lightMode ? '#000' : '#fff', borderRadius: '8px' }}
                              />
                          ))}
                      </div>

                      {pwError && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}
                      
                      <button onClick={handleVerifyOtp} disabled={pwLoading || otp.join('').length < 6} style={{ padding: '14px', backgroundColor: '#46e38a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (pwLoading || otp.join('').length < 6) ? 'not-allowed' : 'pointer', opacity: (pwLoading || otp.join('').length < 6) ? 0.5 : 1 }}>
                          {pwLoading ? "Verifying..." : "Verify Code"}
                      </button>
                  </div>
              )}

              {/* STEP 2: SECURITY QUESTION */}
              {pwStep === 2 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <h4 style={{ color: '#3b82f6' }}>Security Question</h4>
                      <p style={{ fontSize: '0.85rem', color: lightMode ? '#666' : '#aaa' }}>Please answer your security question to continue.</p>
                      
                      <div style={{ background: lightMode ? '#f8f9fa' : 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                          {secQuestion.text}
                      </div>

                      <input 
                          type="text" placeholder="Your Answer" 
                          style={{ padding: '12px', borderRadius: '8px', border: lightMode ? '1px solid #ccc' : '1px solid #444', background: lightMode ? '#fff' : 'transparent', color: lightMode ? '#000' : '#fff' }}
                          value={secAnswer} onChange={(e) => setSecAnswer(e.target.value)}
                      />

                      {pwError && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                      <button onClick={handleAnswerQuestion} disabled={pwLoading || !secAnswer.trim()} style={{ padding: '14px', backgroundColor: '#46e38a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (pwLoading || !secAnswer.trim()) ? 'not-allowed' : 'pointer', opacity: (pwLoading || !secAnswer.trim()) ? 0.5 : 1 }}>
                          {pwLoading ? "Verifying..." : "Submit Answer"}
                      </button>
                  </div>
              )}

              {/* STEP 3: NEW PASSWORD */}
              {pwStep === 3 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <h4 style={{ color: '#3b82f6' }}>Create New Password</h4>
                      
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input 
                              type={showPw ? "text" : "password"} placeholder="New Password" 
                              style={{ width: '100%', padding: '12px', paddingRight: '120px', borderRadius: '8px', border: lightMode ? '1px solid #ccc' : '1px solid #444', background: lightMode ? '#fff' : 'transparent', color: lightMode ? '#000' : '#fff' }}
                              value={newPassword} onChange={(e) => setNewPassword(e.target.value.slice(0,20))}
                          />
                          <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: lightMode ? '#888' : '#aaa', textTransform: 'uppercase', padding: '5px' }}>
                              {showPw ? "Hide Password" : "Show Password"}
                          </button>
                      </div>

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input 
                              type={showConfirmPw ? "text" : "password"} placeholder="Confirm Password" 
                              style={{ width: '100%', padding: '12px', paddingRight: '120px', borderRadius: '8px', border: lightMode ? '1px solid #ccc' : '1px solid #444', background: lightMode ? '#fff' : 'transparent', color: lightMode ? '#000' : '#fff' }}
                              value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value.slice(0,20))}
                          />
                          <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: lightMode ? '#888' : '#aaa', textTransform: 'uppercase', padding: '5px' }}>
                              {showConfirmPw ? "Hide Password" : "Show Password"}
                          </button>
                      </div>

                      <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: lightMode ? '#f8f9fa' : 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: lightMode ? '1px solid #eaeaea' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ color: pwValidation.lengthOk ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• 15-20 characters</div>
                          <div style={{ color: pwValidation.upperOk ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• Uppercase letter</div>
                          <div style={{ color: pwValidation.lowerOk ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• Lowercase letter</div>
                          <div style={{ color: pwValidation.numberOk ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• Number</div>
                          <div style={{ color: pwValidation.symbolOk ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• Symbol (! @ ? _ -)</div>
                          <div style={{ color: passwordsMatch ? '#46e38a' : (lightMode ? '#888' : '#666') }}>• Passwords match</div>
                      </div>

                      {pwError && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                      <button onClick={handleResetPassword} disabled={pwLoading || !pwValidation.strongOk || !passwordsMatch} style={{ padding: '14px', backgroundColor: '#46e38a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (pwLoading || !pwValidation.strongOk || !passwordsMatch) ? 'not-allowed' : 'pointer', opacity: (pwLoading || !pwValidation.strongOk || !passwordsMatch) ? 0.5 : 1 }}>
                          {pwLoading ? "Saving..." : "Set New Password"}
                      </button>
                  </div>
              )}

              {/* STEP 4: SUCCESS */}
              {pwStep === 4 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '20px 0' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#46e38a' }}>SUCCESS</div>
                      <h4 style={{ color: lightMode ? '#1a1a2e' : '#fff' }}>Password Updated</h4>
                      <p style={{ fontSize: '0.85rem', color: lightMode ? '#666' : '#aaa', textAlign: 'center' }}>Your admin password has been successfully changed.</p>
                      <button onClick={resetSettingsState} style={{ marginTop: '10px', padding: '10px 20px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Return to Settings</button>
                  </div>
              )}

            </div>
            {pwStep === 0 && (
                <div className="modal-footer" style={{ borderTop: 'none', padding: '0 30px 30px' }}>
                    <button style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'transparent', border: lightMode ? '1px solid #ccc' : '1px solid #444', color: lightMode ? '#555' : '#aaa', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }} onClick={resetSettingsState}>Close Menu</button>
                </div>
            )}
            {pwStep > 0 && pwStep < 4 && (
                <div className="modal-footer" style={{ borderTop: 'none', padding: '0 30px 30px' }}>
                    <button style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'transparent', border: lightMode ? '1px solid #ccc' : '1px solid #444', color: lightMode ? '#555' : '#aaa', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }} onClick={resetSettingsState}>Cancel Update</button>
                </div>
            )}
          </div>
        </div>
      )}

      {
        showLogoutConfirm && (
          <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <div className="glass-card" style={{ width: '350px', textAlign: 'center', border: '1px solid #444', background: '#1a1a1a' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Log Out</div>
              <p style={{ marginBottom: '2rem', color: '#aaa', fontSize: '0.9rem' }}>
                Are you sure you want to end your secure admin session?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                  className="btn-action"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ background: '#333', flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-action"
                  onClick={doLogout}
                  disabled={actionBusy}
                  style={{ background: '#ef4444', flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 'bold' }}
                >
                  {actionBusy ? 'Logging out...' : 'Log Out'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}