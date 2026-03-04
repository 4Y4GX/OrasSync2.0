"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AutoLogoutProps {
    // Configurable timeout in milliseconds, default to 30 mins (1,800,000 ms)
    timeoutMs?: number;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
export default function AutoLogout({ timeoutMs = INACTIVITY_LIMIT_MS }: AutoLogoutProps) {
    const router = useRouter();
    const [isIdle, setIsIdle] = useState(false);
    const timeoutId = useRef<NodeJS.Timeout | null>(null);

    const handleTimeoutLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error("Auto-logout failed to hit API", error);
        }
    };

    const resetTimer = () => {
        // If they already timed out, do nothing
        if (isIdle) return;

        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        timeoutId.current = setTimeout(() => {
            setIsIdle(true);
            handleTimeoutLogout();
        }, timeoutMs);
    };

    useEffect(() => {
        // Initial setup
        resetTimer();

        // Event listeners for activity
        const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

        events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

        return () => {
            if (timeoutId.current) clearTimeout(timeoutId.current);
            events.forEach((e) => window.removeEventListener(e, resetTimer));
        };
    }, [isIdle, timeoutMs]); // Re-bind if isIdle changes (so it completely stops detecting once idle)

    const proceedToLogin = () => {
        window.location.href = '/login';
    };

    // Do not render anything until idle limit is reached
    if (!isIdle) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999
        }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <div className="modal-body" style={{ padding: '30px 20px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💤</div>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Session Expired</h3>
                    <p style={{ color: 'var(--text-muted)' }}>You have been on idle for 30-minutes. Please log-in again.</p>
                </div>
                <div className="modal-footer" style={{ borderTop: 'none', paddingBottom: '30px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        className="btn-action btn-urgent"
                        style={{ padding: '14px 40px', fontSize: '1rem', fontWeight: 600 }}
                        onClick={proceedToLogin}
                    >
                        Ok
                    </button>
                </div>
            </div>
        </div>
    );
}
