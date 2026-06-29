import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../utils/db';
import { classifyIncident, assignPriority, dispatchTeam } from '../../utils/aiEngine';
import { notify } from '../../components/Notification';
import Sidebar from '../../components/Sidebar';
import KpiCard from '../../components/KpiCard';
import TableCard, { Th, Td } from '../../components/TableCard';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/Badge';
import StatusFlow from '../../components/StatusFlow';
import EmergencyStrip from '../../components/EmergencyStrip';
import DisasterHeatmap from '../../components/maps/DisasterHeatmap';
import WeatherHeatmap from '../../components/maps/WeatherHeatmap';
import LiveTrackingMap from '../../components/maps/LiveTrackingMap';
import EmergencyGuidelines from '../../components/EmergencyGuidelines';
import { supabase, isSupabaseReady } from '../../utils/supabase';

const SIDEBAR_ITEMS = [
  { key: 'overview',   icon: '🏠', label: 'Dashboard' },
  { key: 'report',     icon: '📋', label: 'Report Emergency' },
  { key: 'myreports',  icon: '📁', label: 'My Reports' },
  { key: 'tracking',   icon: '📍', label: 'Live Tracking' },
  { key: 'disaster',   icon: '🗺️', label: 'Disaster Map' },
  { key: 'weather',    icon: '⛈️', label: 'Weather Map' },
  { key: 'guidelines', icon: '🛡️', label: 'Safety Guidelines' },
  { key: 'contacts',   icon: '📞', label: 'Emergency Contacts' },
];

function TypeWriter({ text, speed = 28 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed(''); let i = 0;
    const id = setInterval(() => { i += 1; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span>{displayed}<span style={{ opacity: displayed.length < text.length ? 1 : 0, color: 'var(--purple)' }}>|</span></span>;
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({ user, setTab }) {
  const [reports, setReports]   = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    db.getIncidents({ myOnly: true, userId: user.id })
      .then(data => { setReports(data); setLoading(false); })
      .catch(() => setLoading(false));
    // Load real notifications
    db.getNotifications(user.id).then(setNotifs).catch(() => {});
  }, [user.id]);

  // Realtime: listen for new notifications for this citizen
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel(`citizen-notifs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        payload => {
          const n = payload.new;
          setNotifs(prev => [n, ...prev].slice(0, 10));
          notify(n.message, n.type || 'info');
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user.id]);

  // Realtime: listen for incident updates (user's reports)
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel(`citizen-incidents-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' },
        payload => {
          const inc = payload.new;
          if (inc.reported_by === user.id) {
            setReports(prev => prev.map(r => r.id === inc.id ? { ...r, status: inc.status, eta: inc.eta } : r));
            notify(`📍 Your report "${inc.title}" → ${inc.status}${inc.eta > 0 ? ` · ETA ${inc.eta} min` : ''}`, 'rescue');
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user.id]);

  const active   = reports.filter(i => i.status !== 'Resolved').length;
  const resolved = reports.filter(i => i.status === 'Resolved').length;
  const unread   = notifs.filter(n => !n.is_read).length;

  return (
    <div>
      <EmergencyStrip />
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="My Reports"    value={loading ? '…' : reports.length} color="var(--blue)"   icon="📋" />
        <KpiCard label="Active"        value={loading ? '…' : active}         color="var(--orange)" icon="⚡" />
        <KpiCard label="Resolved"      value={loading ? '…' : resolved}       color="var(--green)"  icon="✅" />
        <KpiCard label="Notifications" value={unread || notifs.length}        color="var(--red)"    icon="🔔" />
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { tab: 'tracking', icon: '📍', label: 'Live Tracking', desc: 'Track your rescue team in real-time', color: '#00E676' },
          { tab: 'disaster', icon: '🗺️', label: 'Disaster Map',  desc: 'View all active incidents near you',  color: '#FF6B1A' },
          { tab: 'weather',  icon: '⛈️', label: 'Weather Map',   desc: 'Live weather conditions & alerts',    color: '#35c7ff' },
        ].map(c => (
          <button key={c.tab} onClick={() => setTab(c.tab)}
            style={{ background: `${c.color}10`, border: `1px solid ${c.color}30`, borderRadius: 10, padding: '12px', textAlign: 'left', color: 'var(--text)', cursor: 'pointer', transition: 'all .2s' }}
            onMouseEnter={e => e.currentTarget.style.background = `${c.color}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${c.color}10`}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      <TableCard title="My Recent Reports" action={<span className="text-xs text-blue-400 cursor-pointer" onClick={() => setTab('myreports')}>View All →</span>}>
        <thead><tr><Th>ID</Th><Th>Title</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">Loading…</td></tr>}
          {!loading && reports.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No reports yet. Submit your first emergency report!</td></tr>}
          {reports.slice(0, 4).map(i => (
            <tr key={i.id} className="hover:bg-white/[.02]">
              <Td className="text-slate-500 font-mono">#{i.id}</Td>
              <Td className="font-medium max-w-[180px] truncate">{i.title}</Td>
              <Td><CategoryBadge category={i.category} /></Td>
              <Td><PriorityBadge priority={i.priority} /></Td>
              <Td><StatusBadge status={i.status} /></Td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {/* Notifications panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
        <div className="font-semibold text-sm mb-3">🔔 Notifications
          {unread > 0 && <span style={{ marginLeft: 8, background: 'rgba(255,77,94,.2)', color: 'var(--critical)', fontSize: 10, padding: '2px 7px', borderRadius: 9999, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{unread} NEW</span>}
        </div>
        {notifs.length === 0 && [
          { msg: 'Flood Rescue Team A dispatched to your report #1 — ETA 8 minutes', type: 'info' },
          { msg: 'Report #6 (Waterlogging Kothrud) has been resolved', type: 'success' },
          { msg: 'NDRF Team A assigned to report #2 — ETA 12 minutes', type: 'info' },
        ].map((n, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 border-b last:border-b-0 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span>{n.type === 'success' ? '✅' : 'ℹ️'}</span>
            <span style={{ color: 'var(--muted)' }}>{n.msg}</span>
          </div>
        ))}
        {notifs.slice(0, 5).map(n => (
          <div key={n.id} className="flex items-start gap-3 py-2.5 border-b last:border-b-0 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span>{n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: 'var(--muted)' }}>{n.message}</span>
              {!n.is_read && <span style={{ marginLeft: 6, background: 'rgba(53,199,255,.15)', color: 'var(--blue)', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>NEW</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Report Form ───────────────────────────────────────────────────────────────
function ReportForm({ user, onSuccess }) {
  const [form, setForm]         = useState({ title: '', desc: '', category: '', location: 'Pune, Maharashtra (18.5204, 73.8567)' });
  const [ai, setAi]             = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [teams, setTeams]       = useState([]);

  useEffect(() => {
    db.getTeams().then(setTeams).catch(console.error);
  }, []);

  const setF = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'title' || k === 'desc') {
      const combined = (k === 'title' ? v : form.title) + ' ' + (k === 'desc' ? v : form.desc);
      if (combined.trim().length > 5) {
        const cat = classifyIncident(combined);
        const pri = assignPriority(combined);
        const { team } = dispatchTeam(cat, 18.5204, 73.8567, teams);
        setAi({ cat, pri, team });
      } else setAi(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.desc) { notify('Please fill title and description.', 'error'); return; }
    setSubmitting(true);
    try {
      const { incident, category, priority, team, eta } = await db.createIncident({
        title: form.title, description: form.desc,
        location: form.location, lat: 18.5204, lng: 73.8567, userId: user.id,
      });
      notify(`Report #${incident.id} submitted! AI classified as ${category} (${priority})`, 'success');
      notify(team ? `${team.name} dispatched — ETA ${eta} min` : 'No teams available right now', team ? 'info' : 'warning');
      onSuccess();
    } catch (e) { notify(e.message, 'error'); }
    setSubmitting(false);
  };

  const INPUT = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      className={`glass-panel rounded-xl p-7 max-w-2xl ${ai?.pri === 'P1' ? 'incident-p1' : ''}`}>
      <h2 className="text-lg font-bold mb-1">🚨 Report an Emergency</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Fill out the form. Our AI will auto-classify and dispatch the nearest team.</p>
      <div className="mb-4">
        <label className="eyebrow block mb-2">Incident Title</label>
        <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. Flood near Pune Station"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={INPUT} />
      </div>
      <div className="mb-4">
        <label className="eyebrow block mb-2">Full Description</label>
        <textarea value={form.desc} onChange={e => setF('desc', e.target.value)} rows={4}
          placeholder="Describe the situation — number of people, severity, what you see…"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-y" style={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="eyebrow block mb-2">Category</label>
          <select value={form.category} onChange={e => setF('category', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={INPUT}>
            <option value="">-- AI will auto-detect --</option>
            {['Flood', 'Fire', 'Road Accident', 'Medical Emergency', 'Building Collapse', 'Unknown'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="eyebrow block mb-2">Location</label>
          <input value={form.location} onChange={e => setF('location', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={INPUT} />
        </div>
      </div>
      <div className="mb-5">
        <label className="eyebrow block mb-2">Attach Photos / Videos (optional)</label>
        <label className="flex items-center justify-center gap-2 w-full rounded-xl py-4 text-sm cursor-pointer"
          style={{ ...INPUT, border: '1px dashed var(--border)', color: 'var(--muted)' }}>
          📎 Click to attach photos or videos
          <input type="file" className="hidden" multiple accept="image/*,video/*" />
        </label>
      </div>
      {ai && (
        <div className="mb-5 rounded-xl px-5 py-4" style={{ background: 'rgba(170,0,255,.07)', border: '1px solid rgba(170,0,255,.3)' }}>
          <div className="eyebrow mb-3" style={{ color: 'var(--purple)' }}>AI CLASSIFICATION // <TypeWriter text={`${ai.cat.toUpperCase()} · ${ai.pri} · MATCH FOUND`} /></div>
          <div className="grid grid-cols-3 gap-3">
            {[['Category', <CategoryBadge key="c" category={ai.cat} />], ['Priority', <PriorityBadge key="p" priority={ai.pri} />], ['Suggested Team', <span key="t" className="text-xs font-semibold text-slate-300">{ai.team ? ai.team.name : 'None available'}</span>]].map(([l, v]) => (
              <div key={l}><div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{l}</div>{v}</div>
            ))}
          </div>
        </div>
      )}
      <button onClick={handleSubmit} disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-sm text-white transition disabled:opacity-60 command-button">
        {submitting ? '⏳ Submitting to Supabase…' : '🚨 Submit Emergency Report'}
      </button>
    </div>
  );
}

// ── My Reports ────────────────────────────────────────────────────────────────
function MyReports({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    db.getIncidents({ myOnly: true, userId: user.id })
      .then(data => { setReports(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.id]);

  const colors = { P1: '#EF4444', P2: '#F97316', P3: '#EAB308', P4: '#22C55E' };
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-base">My Reports ({reports.length})</h2>
      </div>
      {loading && <div className="text-center py-10 text-sm text-slate-500">Loading from Supabase…</div>}
      {!loading && reports.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>No reports yet.</div>}
      {reports.map(i => (
        <div key={i.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${colors[i.priority] || '#475569'}` }}
          className="rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold text-sm">#{i.id} — {i.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{i.location} · {i.createdAt}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0"><PriorityBadge priority={i.priority} /><StatusBadge status={i.status} /></div>
          </div>
          <div className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--muted)' }}>{(i.description || '').slice(0, 120)}…</div>
          <StatusFlow status={i.status} />
          {i.assignedTeam && i.assignedTeam !== 'Unassigned' && (
            <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              🚒 <strong style={{ color: 'var(--text)' }}>{i.assignedTeam}</strong>
              {i.eta > 0 ? ` · ETA ${i.eta} min` : ' · On site'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Contacts ──────────────────────────────────────────────────────────────────
function Contacts() {
  const contacts = [
    { name: 'National Emergency', num: '112', icon: '🆘', color: '#EF4444' },
    { name: 'Fire Brigade', num: '101', icon: '🔥', color: '#F97316' },
    { name: 'Police', num: '100', icon: '👮', color: '#3B82F6' },
    { name: 'Ambulance', num: '108', icon: '🚑', color: '#22C55E' },
    { name: 'NDMA Helpline', num: '1078', icon: '⚠️', color: '#EAB308' },
    { name: 'Ruby Hall Clinic', num: '020-66455000', icon: '🏥', color: '#3B82F6' },
    { name: 'KEM Hospital', num: '020-26125600', icon: '🏥', color: '#3B82F6' },
    { name: 'Sassoon Hospital', num: '020-26128000', icon: '🏥', color: '#3B82F6' },
  ];
  return (
    <div>
      <h2 className="font-bold text-base mb-5">Emergency Contacts</h2>
      <div className="grid grid-cols-3 gap-4">
        {contacts.map(c => (
          <div key={c.name} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${c.color}` }} className="rounded-xl p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="font-semibold text-sm mb-1">{c.name}</div>
            <div className="text-xl font-extrabold" style={{ color: c.color }}>{c.num}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CitizenDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  // Find the citizen's active incident for live tracking
  const [myActiveIncident, setMyActiveIncident] = useState(null);
  useEffect(() => {
    if (user?.id) {
      db.getIncidents({ myOnly: true, userId: user.id })
        .then(data => {
          const active = data.find(i => i.status !== 'Resolved' && i.assignedTeam);
          setMyActiveIncident(active || null);
        }).catch(() => {});
    }
  }, [user?.id]);

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <Sidebar items={SIDEBAR_ITEMS} activeTab={tab} onTabChange={setTab}
        header={{ label: 'Citizen Portal', name: user?.name }} />
      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'overview'   && <Overview user={user} setTab={setTab} />}
        {tab === 'report'     && <ReportForm user={user} onSuccess={() => setTab('overview')} />}
        {tab === 'myreports'  && <MyReports user={user} />}
        {tab === 'tracking'   && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700 }}>📍 Live Team Tracking</h2>
              {myActiveIncident && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tracking: <strong style={{ color: 'var(--text)' }}>{myActiveIncident.assignedTeam}</strong></span>}
            </div>
            {myActiveIncident ? (
              <>
                <div style={{ background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  ✅ <strong>{myActiveIncident.assignedTeam}</strong> is responding to your report "<em>{myActiveIncident.title}</em>"
                  {myActiveIncident.eta > 0 && <span style={{ color: 'var(--safe)', marginLeft: 8, fontFamily: 'JetBrains Mono' }}>ETA: {myActiveIncident.eta} min</span>}
                </div>
                <LiveTrackingMap height={420} userRole="citizen"
                  assignedTeam={myActiveIncident.assignedTeam}
                  incidentId={myActiveIncident.id} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
                <div>No active rescue team assigned to your reports yet.</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Live tracking will appear once a team is dispatched.</div>
              </div>
            )}
          </div>
        )}
        {tab === 'disaster'   && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>🗺️ Disaster Heatmap — Pune Region</h2>
            <DisasterHeatmap height={520} readOnly={true} />
          </div>
        )}
        {tab === 'weather'    && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>⛈️ Live Weather Map — Pune Region</h2>
            <WeatherHeatmap height={440} showPanel={true} />
          </div>
        )}
        {tab === 'guidelines' && <EmergencyGuidelines />}
        {tab === 'contacts'   && <Contacts />}
      </main>
    </div>
  );
}
