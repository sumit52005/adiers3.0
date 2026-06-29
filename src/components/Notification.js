import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase, isSupabaseReady } from '../utils/supabase';

// ── Global imperative notify() ────────────────────────────────────────────────
let _notify = null;
export function notify(msg, type = 'info', opts = {}) {
  if (_notify) _notify(msg, type, opts);
}

const ICONS    = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️', disaster:'🌊', weather:'⛈️', rescue:'🚒', medical:'🚑' };
const BORDERS  = { success:'var(--safe)', error:'var(--critical)', info:'var(--blue)', warning:'var(--orange)', disaster:'var(--orange)', weather:'var(--blue)', rescue:'var(--safe)', medical:'#f472b6' };

// ── NotificationProvider — mount once in App ─────────────────────────────────
export function NotificationProvider({ userId, userRole }) {
  const [items, setItems] = useState([]);
  const channelRef = useRef(null);

  const push = useCallback((msg, type = 'info', opts = {}) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev.slice(-4), { id, msg, type, link: opts.link }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 5000);
  }, []);

  useEffect(() => { _notify = push; return () => { _notify = null; }; }, [push]);

  // ── Supabase Realtime subscriptions ──────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !userId) return;

    // 1. Listen for new/updated incidents (all roles)
    const incidentCh = supabase.channel('incidents-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        if (userRole === 'authority' || userRole === 'rescue_team') {
          push(`🆕 New incident: ${inc.title} (${inc.priority})`, 'disaster', { link: '/authority' });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        // Citizens get ETA updates on their reports
        if (userRole === 'citizen' && inc.reported_by === userId) {
          push(`📍 Your report "${inc.title}" → ${inc.status}${inc.eta > 0 ? ` · ETA ${inc.eta} min` : ''}`, 'rescue');
        }
        // Rescue teams get assignment notifications
        if (userRole === 'rescue_team' && inc.status === 'Assigned') {
          push(`🚒 Mission assigned: ${inc.title} (${inc.priority})`, 'rescue');
        }
      })
      .subscribe();

    // 2. Listen for notifications table (user-specific)
    const notifCh = supabase.channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const n = payload.new;
        push(n.message, n.type || 'info');
      })
      .subscribe();

    channelRef.current = [incidentCh, notifCh];

    // 3. Rescue team status changes
    const teamCh = supabase.channel('teams-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rescue_teams' }, payload => {
        const t = payload.new;
        if (userRole === 'authority') {
          push(`🚒 ${t.name} → ${t.status}`, 'info');
        }
      })
      .subscribe();

    channelRef.current.push(teamCh);

    return () => {
      channelRef.current?.forEach(ch => supabase.removeChannel(ch));
    };
  }, [userId, userRole, push]);

  return createPortal(
    <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340, pointerEvents: 'none' }}>
      {items.map(item => (
        <div key={item.id} className="notif-slide"
          style={{
            pointerEvents: 'auto',
            background: 'linear-gradient(145deg,rgba(16,25,46,.97),rgba(10,16,32,.95))',
            border: '1px solid var(--border2)',
            borderLeft: `4px solid ${BORDERS[item.type] || BORDERS.info}`,
            borderRadius: 10,
            padding: '11px 14px',
            fontSize: 13,
            boxShadow: '0 8px 28px rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
            cursor: item.link ? 'pointer' : 'default',
            position: 'relative', overflow: 'hidden',
          }}
          onClick={() => item.link && (window.location.href = item.link)}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>{ICONS[item.type] || ICONS.info}</span>
          <span style={{ color: 'var(--text)', lineHeight: 1.4 }}>{item.msg}</span>
          {/* progress bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,.06)' }}>
            <div style={{ height: '100%', background: BORDERS[item.type] || BORDERS.info, animation: 'toast-progress 5s linear forwards' }} />
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
