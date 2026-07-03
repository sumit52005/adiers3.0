import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, ChevronDown, LogOut, ShieldCheck, Zap, X, Check, CheckCheck } from 'lucide-react';
import { requestNotificationPermission } from './Notification';

// ─── Static ticker incidents (decorative scroll) ──────────────────────────────
const TICKER = [
  ['P1', 'FLOOD', 'Pune Station', 'LIVE'],
  ['P2', 'FIRE', 'Hadapsar Industrial', '12m AGO'],
  ['P1', 'COLLAPSE', 'Shivajinagar', 'LIVE'],
  ['P3', 'MEDICAL', 'Kothrud Depot', '21m AGO'],
  ['P2', 'LANDSLIDE', 'Lavasa Hills', '34m AGO'],
];

// ─── Type styling ─────────────────────────────────────────────────────────────
const NOTIF_ICONS = {
  success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️',
  disaster: '🌊', weather: '⛈️', rescue: '🚒', medical: '🚑',
  critical: '🔴', incident: '⚡',
};
const NOTIF_COLORS = {
  success: '#00E676', error: '#FF2D2D', info: '#35c7ff',
  warning: '#FF6B1A', disaster: '#FF6B1A', weather: '#35c7ff',
  rescue: '#00E676', medical: '#f472b6', critical: '#FF2D2D', incident: '#FF6B1A',
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mono text-right">
      <div style={{ fontSize: 9, letterSpacing: '.16em', color: 'var(--muted)' }}>IST · LIVE</div>
      <div style={{ fontSize: 13, letterSpacing: '.13em', color: 'var(--safe)' }}>
        {time.toLocaleTimeString('en-IN', { hour12: false })}
      </div>
    </div>
  );
}

function Ticker() {
  const list = [...TICKER, ...TICKER];
  return (
    <div className="ticker-window nav-ticker flex-1 max-w-3xl">
      <div className="ticker-track">
        {list.map((x, i) => (
          <div className="ticker-item" key={i}>
            <span className="live-dot" />
            <b style={{ color: x[0] === 'P1' ? 'var(--critical)' : 'var(--high)' }}>{x[0]}</b>
            <span>·</span>
            <b style={{ color: 'var(--text)' }}>{x[1]}</b>
            <span>· {x[2]} · {x[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Notification Bell with full dropdown panel ────────────────────────────────
function NotifBell() {
  const [open, setOpen]       = useState(false);
  const [history, setHistory] = useState([]);
  const [unread, setUnread]   = useState(0);
  const [permState, setPermState] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const panelRef = useRef(null);

  // Subscribe to notification state changes dispatched by NotificationProvider
  useEffect(() => {
    function onUpdate(e) {
      setHistory(e.detail.history || []);
      setUnread(e.detail.unread || 0);
    }
    window.addEventListener('aedirs-notif-update', onUpdate);
    return () => window.removeEventListener('aedirs-notif-update', onUpdate);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    // Mark all as read when panel opens
    if (!open) {
      setTimeout(() => {
        if (window.__notifClearUnread) window.__notifClearUnread();
      }, 300);
    }
  };

  const handleClear = () => {
    if (window.__notifClearHistory) window.__notifClearHistory();
    setOpen(false);
  };

  const requestPerm = async () => {
    const perm = await requestNotificationPermission();
    setPermState(perm);
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return d.toLocaleDateString();
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', width: 36, height: 36, display: 'grid', placeItems: 'center',
          borderRadius: 8, background: open ? 'rgba(53,199,255,.15)' : 'var(--panel)',
          border: '1px solid ' + (open ? 'rgba(53,199,255,.4)' : 'var(--border)'),
          cursor: 'pointer', transition: 'all .2s',
        }}
        title="Notifications"
      >
        <Bell
          size={15}
          color={unread > 0 ? 'var(--orange)' : 'var(--muted)'}
          style={{ animation: unread > 0 ? 'notif-bell-shake 0.5s ease-in-out' : 'none' }}
        />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            width: unread > 9 ? 20 : 16, height: 16, borderRadius: 9999,
            display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700,
            fontFamily: 'JetBrains Mono', background: 'var(--critical)',
            color: '#fff', border: '1.5px solid var(--bg)',
            animation: 'badge-pop .3s ease',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 360, maxHeight: 480,
          background: 'linear-gradient(160deg,rgba(16,25,46,.99),rgba(10,16,32,.98))',
          border: '1px solid rgba(53,199,255,.2)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.7)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          animation: 'panel-drop .2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            background: 'rgba(53,199,255,.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} color="var(--blue)" />
              <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, letterSpacing: '.04em' }}>
                Notifications
              </span>
              {unread > 0 && (
                <span style={{
                  background: 'rgba(255,77,94,.2)', color: 'var(--critical)',
                  fontSize: 10, padding: '2px 7px', borderRadius: 9999,
                  fontFamily: 'JetBrains Mono', fontWeight: 700,
                }}>
                  {unread} NEW
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {history.length > 0 && (
                <button onClick={handleClear}
                  style={{
                    fontSize: 10, fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                    color: 'var(--muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                  }}>
                  <CheckCheck size={11} /> Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Browser permission banner */}
          {permState !== 'granted' && permState !== 'unsupported' && (
            <div style={{
              padding: '10px 16px', background: 'rgba(255,107,26,.08)',
              borderBottom: '1px solid rgba(255,107,26,.2)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', marginBottom: 2 }}>
                  Enable browser notifications
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  Get OS-level alerts for disasters & emergencies
                </div>
              </div>
              <button onClick={requestPerm}
                style={{
                  background: 'var(--orange)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                Allow
              </button>
            </div>
          )}
          {permState === 'granted' && (
            <div style={{
              padding: '7px 16px', background: 'rgba(0,230,118,.06)',
              borderBottom: '1px solid rgba(0,230,118,.12)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#86EFAC',
            }}>
              <Check size={11} /> Browser notifications are active
            </div>
          )}

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {history.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                No notifications yet.<br />
                <span style={{ fontSize: 11 }}>Live alerts will appear here.</span>
              </div>
            ) : (
              history.map((item, idx) => (
                <div key={item.id || idx}
                  onClick={() => item.link && (window.location.href = item.link)}
                  style={{
                    padding: '11px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    cursor: item.link ? 'pointer' : 'default',
                    background: idx === 0 ? 'rgba(53,199,255,.03)' : 'transparent',
                    transition: 'background .15s',
                    borderLeft: '3px solid ' + (NOTIF_COLORS[item.type] || NOTIF_COLORS.info),
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx === 0 ? 'rgba(53,199,255,.03)' : 'transparent'}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {NOTIF_ICONS[item.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
                      {item.msg}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
                      {fmtTime(item.ts)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.06)',
            textAlign: 'center', fontSize: 10, color: 'var(--muted)',
            fontFamily: 'JetBrains Mono',
          }}>
            {history.length > 0 ? `${history.length} notification${history.length !== 1 ? 's' : ''} · Powered by Supabase Realtime` : 'Listening for live events…'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const home = () =>
    navigate(user ? (user.role === 'rescue_team' ? '/rescue' : `/${user.role}`) : '/');

  return (
    <nav className="command-nav sticky top-0 z-50 relative flex items-center gap-5 px-6">
      {/* Logo */}
      <button onClick={home} className="flex items-center gap-3 shrink-0 text-left">
        <div className="w-9 h-9 grid place-items-center rounded-md"
          style={{ background: 'rgba(53,199,255,.1)', border: '1px solid rgba(53,199,255,.38)', boxShadow: '0 0 20px rgba(53,199,255,.14)' }}>
          <Zap size={19} color="var(--blue)" fill="var(--blue)" />
        </div>
        <div>
          <div className="text-xl font-bold leading-none tracking-[.08em]" style={{ fontFamily: 'Rajdhani' }}>
            AE<span style={{ color: 'var(--blue)' }}>DIRS</span>
          </div>
          <div className="text-[8px] tracking-[.18em] mt-1" style={{ color: 'var(--muted)' }}>
            EMERGENCY OPS CENTER
          </div>
        </div>
      </button>

      {/* All systems */}
      <div className="nav-status hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-md"
        style={{ border: '1px solid var(--border)', background: 'rgba(0,230,118,.04)' }}>
        <span className="w-1.5 h-1.5 rounded-full dot-available" style={{ background: 'var(--safe)' }} />
        <span className="text-[9px] mono tracking-wider" style={{ color: 'var(--safe)' }}>ALL SYSTEMS OPERATIONAL</span>
      </div>

      <Ticker />

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <LiveClock />

        {user ? (
          <>
            {/* Live Bell */}
            <NotifBell />

            {/* User dropdown */}
            <div className="relative">
              <button onClick={() => setOpen(v => !v)}
                className="nav-role flex items-center gap-2 rounded-md px-2.5 py-1.5"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <div className="w-7 h-7 rounded grid place-items-center font-bold text-xs"
                  style={{ background: 'rgba(41,121,255,.15)', color: '#79a8ff' }}>
                  {user.name?.[0]}
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold max-w-28 truncate">{user.name}</div>
                  <div className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    {user.role?.replace('_', ' ')}
                  </div>
                </div>
                <ChevronDown size={12} />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 w-52 glass-panel rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-semibold">Authenticated operator</div>
                    <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--muted)' }}>{user.email}</div>
                  </div>
                  <button onClick={() => { logout(); navigate('/'); }}
                    className="w-full flex gap-2 px-4 py-3 text-xs" style={{ color: '#ff6b6b' }}>
                    <LogOut size={14} /> Terminate session
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/login')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-semibold"
              style={{ color: 'var(--muted)' }}>
              <ShieldCheck size={14} /> Authority Login
            </button>
            <button onClick={() => navigate('/login')}
              className="command-button px-4 py-2 rounded-md text-xs font-bold tracking-wide">
              REPORT EMERGENCY
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
