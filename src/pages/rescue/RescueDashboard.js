import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../utils/db';
import { notify } from '../../components/Notification';
import Sidebar from '../../components/Sidebar';
import KpiCard from '../../components/KpiCard';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/Badge';
import DisasterHeatmap from '../../components/maps/DisasterHeatmap';
import WeatherHeatmap from '../../components/maps/WeatherHeatmap';
import LiveTrackingMap from '../../components/maps/LiveTrackingMap';
import { supabase, isSupabaseReady } from '../../utils/supabase';

const SIDEBAR = [
  { key: 'overview',  icon: '🏠', label: 'Team Dashboard' },
  { key: 'assigned',  icon: '📌', label: 'Assigned Cases' },
  { key: 'tracking',  icon: '📍', label: 'Live Tracking' },
  { key: 'disaster',  icon: '🗺️', label: 'Disaster Map' },
  { key: 'weather',   icon: '⛈️', label: 'Weather Map' },
  { key: 'missions',  icon: '✅', label: 'Completed' },
  { key: 'status',    icon: '🔄', label: 'Team Status' },
];

function Overview({ user, setTab }) {
  const [incidents, setIncidents] = useState([]);
  const [teams, setTeams]         = useState([]);
  const [notifs, setNotifs]       = useState([]);

  useEffect(() => {
    db.getIncidents().then(setIncidents).catch(() => {});
    db.getTeams().then(setTeams).catch(() => {});
    db.getNotifications(user?.id).then(setNotifs).catch(() => {});
  }, [user?.id]);

  // Realtime: new incidents assigned to rescue team
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('rescue-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        notify(`🚨 New incident: ${inc.title} (${inc.priority}) — check Assigned Cases`, 'disaster');
        setIncidents(prev => [inc, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, payload => {
        setIncidents(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const myTeamName = 'Fire Team A'; // In production, derive from user profile
  const assigned   = incidents.filter(i => i.assignedTeam === myTeamName && i.status !== 'Resolved');

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="Active Missions"  value={assigned.length} color="var(--orange)" icon="🚒" />
        <KpiCard label="Completed"        value={incidents.filter(i => i.status === 'Resolved').length} color="var(--green)" icon="✅" />
        <KpiCard label="Team Members"     value={6}               color="var(--blue)"   icon="👥" />
        <KpiCard label="Team Status"      value="On Route"        color="var(--orange)" icon="📍" />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { tab: 'tracking', icon: '📍', label: 'Live Tracking',  color: '#00E676' },
          { tab: 'disaster', icon: '🗺️', label: 'Disaster Map',   color: '#FF6B1A' },
          { tab: 'weather',  icon: '⛈️', label: 'Weather Alert',  color: '#35c7ff' },
        ].map(c => (
          <button key={c.tab} onClick={() => setTab(c.tab)}
            style={{ background: `${c.color}10`, border: `1px solid ${c.color}30`, borderRadius: 10, padding: '12px', textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
          </button>
        ))}
      </div>

      {assigned.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--critical)' }} className="rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">🚨 Current Active Mission</h3>
            <PriorityBadge priority={assigned[0].priority} />
          </div>
          <div className="px-4 py-3 rounded-xl mb-3 text-sm flex gap-2" style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)' }}>
            ℹ️ <span style={{ color: 'var(--muted)' }}>{assigned[0].title} — ETA: <strong style={{ color: 'var(--text)' }}>{assigned[0].eta > 0 ? `${assigned[0].eta} min` : 'On site'}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            {[['Location', assigned[0].location], ['Category', assigned[0].category], ['Priority', assigned[0].priority]].map(([k, v]) => (
              <div key={k}><div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{k}</div><div className="font-medium">{v}</div></div>
            ))}
          </div>
          <div className="flex gap-2">
            {['Mark In Progress', 'Open Navigation', 'Complete Mission'].map((label, i) => (
              <button key={label} onClick={() => notify(`${label} ✅`, 'success')}
                className="px-4 py-2 rounded-xl text-xs font-bold transition"
                style={{ background: ['rgba(34,197,94,.15)', 'rgba(59,130,246,.15)', 'rgba(239,68,68,.15)'][i], color: ['#86EFAC', '#93C5FD', '#FCA5A5'][i] }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3">🔔 Notifications</h3>
        {(notifs.length > 0 ? notifs : [
          { message: 'New mission assigned: Vehicle fire on Mumbai-Pune Expressway', type: 'info' },
          { message: 'Weather alert: Heavy rain expected in Pune zone', type: 'warning' },
          { message: 'Previous mission #6 resolved successfully', type: 'success' },
        ]).slice(0, 5).map((n, i) => (
          <div key={n.id || i} className="flex gap-2 py-2.5 text-sm border-b last:border-b-0" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <span>{n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</span>{n.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignedCases() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    db.getIncidents()
      .then(data => { setIncidents(data.filter(i => i.assignedTeam === 'Fire Team A' && i.status !== 'Resolved')); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const colors = { P1: '#EF4444', P2: '#F97316', P3: '#EAB308', P4: '#22C55E' };

  return (
    <div>
      <h2 className="font-bold text-base mb-5">Assigned Cases ({incidents.length})</h2>
      {loading && <div className="text-center py-10 text-sm text-slate-500">Loading…</div>}
      {!loading && incidents.length === 0 && <div className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>No active assignments!</div>}
      {incidents.map(i => (
        <div key={i.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${colors[i.priority]}` }} className="rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between mb-2"><div className="font-semibold text-sm">#{i.id} — {i.title}</div><PriorityBadge priority={i.priority} /></div>
          <div className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--muted)' }}>{(i.description || '').slice(0, 120)}</div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            {[['Location', i.location], ['ETA', i.eta > 0 ? `${i.eta} min` : 'On site']].map(([k, v]) => (
              <div key={k}><span style={{ color: 'var(--muted)' }}>{k}: </span><span className="font-semibold">{v}</span></div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { db.updateIncidentStatus(i.id, 'In Progress'); notify(`Incident #${i.id} → In Progress`, 'success'); setIncidents(prev => prev.filter(inc => inc.id !== i.id)); }}
              className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(34,197,94,.15)', color: '#86EFAC' }}>In Progress</button>
            <button onClick={() => { db.updateIncidentStatus(i.id, 'Resolved'); notify(`Incident #${i.id} Resolved ✅`, 'success'); setIncidents(prev => prev.filter(inc => inc.id !== i.id)); }}
              className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(59,130,246,.15)', color: '#93C5FD' }}>Mark Resolved</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamStatus({ user }) {
  const [current, setCurrent] = useState('On Route');
  const [members, setMembers] = useState([]);
  useEffect(() => { db.getTeamMembers(1).then(setMembers).catch(() => {}); }, []);

  const STATUSES = ['Available', 'Busy', 'On Route', 'Emergency Mode'];
  return (
    <div>
      <h2 className="font-bold text-base mb-5">Team Status</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5 mb-4">
        <h3 className="font-semibold text-sm mb-4">Update Your Team Status</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {STATUSES.map(s => (
            <button key={s} onClick={async () => { setCurrent(s); await db.updateTeamStatus(1, s); notify(`Status → ${s}`, 'success'); }}
              className="py-3 rounded-xl text-sm font-bold transition"
              style={{ background: current === s ? 'var(--critical)' : 'var(--surface2)', color: current === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
          Current: <strong>{current}</strong>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4">Team Members ({members.length || 6})</h3>
        {(members.length ? members : ['Rajan P.', 'Suresh K.', 'Amit S.', 'Pradeep M.', 'Vijay T.', 'Mahesh R.'].map((name, i) => ({ id: i, name, grade: i < 2 ? 'Grade A' : 'Grade B', status: 'Active' }))).map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(59,130,246,.15)', color: '#93C5FD' }}>{(m.name || '?').charAt(0)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.grade}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,94,.2)', color: '#86EFAC' }}>{m.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RescueDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <Sidebar items={SIDEBAR} activeTab={tab} onTabChange={setTab}
        header={{ label: 'Rescue Portal', name: user?.name }} />
      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'overview'  && <Overview user={user} setTab={setTab} />}
        {tab === 'assigned'  && <AssignedCases />}
        {tab === 'tracking'  && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>📍 Live Tracking — All Units</h2>
            <LiveTrackingMap height={500} userRole="rescue_team" />
          </div>
        )}
        {tab === 'disaster'  && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>🗺️ Live Disaster Heatmap</h2>
            <DisasterHeatmap height={500} />
          </div>
        )}
        {tab === 'weather'   && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>⛈️ Weather Map — Operating Zone</h2>
            <WeatherHeatmap height={440} />
          </div>
        )}
        {tab === 'missions'  && (
          <div>
            <h2 className="font-bold text-base mb-5">Completed Missions</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold text-sm">#6 — Waterlogging Kothrud</div><span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(100,116,139,.2)', color: '#94A3B8' }}>P4</span></div>
              <div className="grid grid-cols-3 gap-3 text-xs"><div><div style={{ color: 'var(--muted)' }}>Location</div><div className="font-medium">Kothrud</div></div><div><div style={{ color: 'var(--muted)' }}>Category</div><div>Flood</div></div><div><div style={{ color: 'var(--muted)' }}>Duration</div><div>2h 30m</div></div></div>
              <div style={{ background: 'rgba(34,197,94,.1)', color: '#86EFAC', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 10 }}>✅ Mission completed</div>
            </div>
          </div>
        )}
        {tab === 'status'    && <TeamStatus user={user} />}
      </main>
    </div>
  );
}
