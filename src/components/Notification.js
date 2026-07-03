import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase, isSupabaseReady } from '../utils/supabase';

// ─── Global imperative notify() ───────────────────────────────────────────────
let _notify = null;
export function notify(msg, type = 'info', opts = {}) {
  if (_notify) _notify(msg, type, opts);
}

// ─── Browser Push Notification helper ─────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

function sendBrowserNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'aedirs-' + Date.now() });
  } catch (_) {}
}

// ─── Type maps ────────────────────────────────────────────────────────────────
const ICONS = {
  success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️',
  disaster: '🌊', weather: '⛈️', rescue: '🚒', medical: '🚑',
  critical: '🔴', incident: '⚡',
};
const BORDERS = {
  success: 'var(--safe)', error: 'var(--critical)', info: 'var(--blue)',
  warning: 'var(--orange)', disaster: '#FF6B1A', weather: '#35c7ff',
  rescue: 'var(--safe)', medical: '#f472b6', critical: '#FF2D2D', incident: '#FF6B1A',
};
const TYPE_LABEL = {
  success: 'SUCCESS', error: 'ERROR', info: 'INFO', warning: 'WARNING',
  disaster: 'DISASTER ALERT', weather: 'WEATHER ALERT', rescue: 'RESCUE UPDATE',
  medical: 'MEDICAL', critical: 'CRITICAL', incident: 'INCIDENT',
};

// ─── NotificationProvider — mount once in App ─────────────────────────────────
export function NotificationProvider({ userId, userRole }) {
  const [toasts, setToasts]       = useState([]);
  const [history, setHistory]     = useState([]);
  const [unread, setUnread]       = useState(0);
  const [permAsked, setPermAsked] = useState(false);
  const channelRef                = useRef(null);

  // ── Core push function ────────────────────────────────────────────────────
  const push = useCallback((msg, type = 'info', opts = {}) => {
    const id = Date.now() + Math.random();
    const entry = { id, msg, type, link: opts.link, ts: new Date() };

    // In-app toast (keep max 5 visible)
    setToasts(prev => [...prev.slice(-4), entry]);
    setTimeout(() => setToasts(prev => prev.filter(i => i.id !== id)), 6000);

    // Persistent history (max 60)
    setHistory(prev => [entry, ...prev].slice(0, 60));
    setUnread(n => n + 1);

    // OS browser notification for high-priority types
    if (['disaster', 'critical', 'warning', 'weather', 'rescue'].includes(type)) {
      sendBrowserNotif('AEDIRS — ' + (TYPE_LABEL[type] || 'Alert'), (ICONS[type] || '') + ' ' + msg);
    }
  }, []);

  useEffect(() => { _notify = push; return () => { _notify = null; }; }, [push]);

  // ── Expose state to Navbar via custom event ───────────────────────────────
  useEffect(() => {
    window.__notifClearUnread = () => setUnread(0);
    window.__notifClearHistory = () => { setHistory([]); setUnread(0); };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aedirs-notif-update', {
      detail: { history, unread }
    }));
  }, [history, unread]);

  // ── Request browser notification permission (2 s after login) ────────────
  useEffect(() => {
    if (permAsked || !userId) return;
    setPermAsked(true);
    const t = setTimeout(async () => {
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        push('🔔 Browser notifications enabled! You\'ll receive live disaster alerts.', 'success');
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [userId, permAsked, push]);

  // ── Supabase Realtime subscriptions ───────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !userId) return;

    // 1. Incidents — new reports and status updates
    const incidentCh = supabase.channel('aedirs-notif-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        const isP1 = inc.priority === 'P1';
        if (userRole === 'authority' || userRole === 'rescue_team') {
          push(
            `${isP1 ? '🔴 CRITICAL' : '🆕 New'} incident: "${inc.title}" · ${inc.priority} · ${inc.category || 'Unknown'}`,
            isP1 ? 'critical' : 'disaster',
            { link: userRole === 'rescue_team' ? '/rescue' : '/authority' }
          );
        }
        if (userRole === 'citizen') {
          push(`⚡ New emergency reported: "${inc.title}" — stay alert`, 'incident');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        const old = payload.old;

        // Citizen: own report updated
        if (userRole === 'citizen' && inc.reported_by === userId) {
          push(
            `📍 Your report "${inc.title}" → ${inc.status}${inc.eta > 0 ? ' · ETA ' + inc.eta + ' min' : ''}`,
            'rescue'
          );
        }
        // Rescue team: newly assigned
        if (userRole === 'rescue_team' && inc.assigned_team && old?.assigned_team !== inc.assigned_team) {
          push(`🚒 Mission assigned: "${inc.title}" (${inc.priority})`, 'rescue');
        }
        // Authority: status change
        if (userRole === 'authority' && old?.status !== inc.status) {
          push(`📋 Incident #${inc.id} → ${inc.status}`, 'info');
        }
      })
      .subscribe();

    // 2. User-specific notification rows
    const notifCh = supabase.channel('aedirs-notif-user-' + userId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + userId,
      }, payload => {
        const n = payload.new;
        push(n.message, n.type || 'info');
      })
      .subscribe();

    // 3. Rescue team status changes
    const teamCh = supabase.channel('aedirs-notif-teams')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rescue_teams' }, payload => {
        const t = payload.new;
        const old = payload.old;
        if (old?.status === t.status) return;
        if (userRole === 'authority') push(`🚒 ${t.name}: ${old?.status} → ${t.status}`, 'rescue');
        if (userRole === 'rescue_team') push(`📡 ${t.name} is now ${t.status}`, 'info');
        if (userRole === 'citizen' && t.status === 'On Route') push(`🚒 A rescue team is on route to an incident near you`, 'rescue');
      })
      .subscribe();

    channelRef.current = [incidentCh, notifCh, teamCh];
    return () => { channelRef.current?.forEach(ch => supabase.removeChannel(ch)); };
  }, [userId, userRole, push]);

  return createPortal(
    <div style={{
      position: 'fixed', top: 72, right: 16, zIndex: 10000,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 360, pointerEvents: 'none',
    }}>
      {toasts.map(item => (
        <div key={item.id} className="notif-slide"
          style={{
            pointerEvents: 'auto',
            background: 'linear-gradient(145deg,rgba(16,25,46,.98),rgba(10,16,32,.97))',
            border: '1px solid var(--border2)',
            borderLeft: '4px solid ' + (BORDERS[item.type] || BORDERS.info),
            borderRadius: 10, padding: '12px 14px', fontSize: 13,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: item.link ? 'pointer' : 'default',
            position: 'relative', overflow: 'hidden',
          }}
          onClick={() => item.link && (window.location.href = item.link)}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{ICONS[item.type] || ICONS.info}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700,
              letterSpacing: '.1em', marginBottom: 3,
              color: BORDERS[item.type] || BORDERS.info,
            }}>
              {TYPE_LABEL[item.type] || 'NOTIFICATION'}
            </div>
            <div style={{ color: 'var(--text)', lineHeight: 1.45, fontSize: 12.5 }}>{item.msg}</div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,.04)' }}>
            <div style={{ height: '100%', background: BORDERS[item.type] || BORDERS.info, animation: 'toast-progress 6s linear forwards' }} />
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
