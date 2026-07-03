import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../utils/db';
import { notify } from '../../components/Notification';
import Sidebar from '../../components/Sidebar';
import KpiCard from '../../components/KpiCard';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/Badge';
import DisasterHeatmap from '../../components/maps/DisasterHeatmap';
import WeatherHeatmap from '../../components/maps/WeatherHeatmap';
import LiveTrackingMap from '../../components/maps/LiveTrackingMap';
import TeamBaseTracker from '../../components/TeamBaseTracker';
import { supabase, isSupabaseReady } from '../../utils/supabase';
import { haversine, calculateETA, rankTeams } from '../../utils/aiEngine';

const SIDEBAR = [
  { key: 'overview',  icon: '🏠', label: 'Team Dashboard' },
  { key: 'assigned',  icon: '📌', label: 'Assigned Cases' },
  { key: 'tracking',  icon: '📍', label: 'Live Tracking'  },
  { key: 'disaster',  icon: '🗺️', label: 'Disaster Map'   },
  { key: 'weather',   icon: '⛈️', label: 'Weather Map'    },
  { key: 'missions',  icon: '✅', label: 'Completed'       },
  { key: 'status',    icon: '🔄', label: 'Team Status'     },
];

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ user, setTab, myTeam, setMyTeam }) {
  const [incidents, setIncidents] = useState([]);
  const [teams, setTeams]         = useState([]);
  const [notifs, setNotifs]       = useState([]);

  useEffect(() => {
    db.getIncidents().then(setIncidents).catch(() => {});
    db.getTeams().then(setTeams).catch(() => {});
    db.getNotifications(user?.id).then(setNotifs).catch(() => {});
  }, [user?.id]);

  // Realtime: new incidents
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('rescue-incidents-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        notify(`🚨 New incident: ${inc.title} (${inc.priority})`, 'disaster');
        setIncidents(prev => [inc, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, payload => {
        setIncidents(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // The "my team" name — derived from TeamBaseTracker or profile match
  const myTeamName = myTeam?.name || user?.name || '';
  const assigned   = incidents.filter(i =>
    i.assignedTeam && myTeamName &&
    i.assignedTeam.toLowerCase() === myTeamName.toLowerCase() &&
    i.status !== 'Resolved'
  );

  // Distance to active mission
  const activeInc = assigned[0];
  const distToMission = (activeInc && myTeam?.lat && activeInc.lat)
    ? haversine(myTeam.lat, myTeam.lng, activeInc.lat, activeInc.lng)
    : null;

  return (
    <div>
      {/* ── Base location tracker ── */}
      <TeamBaseTracker user={user} onTeamResolved={setMyTeam} />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="Active Missions"  value={assigned.length}
                 color="var(--orange)" icon="🚒" />
        <KpiCard label="Completed"
                 value={incidents.filter(i => i.status === 'Resolved').length}
                 color="var(--green)" icon="✅" />
        <KpiCard label="Team Members"     value={myTeam?.members || '—'}
                 color="var(--blue)"   icon="👥" />
        <KpiCard label="Base Set"         value={myTeam?.lat ? 'YES' : 'NO'}
                 color={myTeam?.lat ? 'var(--safe)' : 'var(--orange)'} icon="📍" />
      </div>

      {/* ── Quick nav ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { tab: 'tracking', icon: '📍', label: 'Live Tracking',  color: '#00E676' },
          { tab: 'disaster', icon: '🗺️', label: 'Disaster Map',   color: '#FF6B1A' },
          { tab: 'weather',  icon: '⛈️', label: 'Weather Alert',  color: '#35c7ff' },
        ].map(c => (
          <button key={c.tab} onClick={() => setTab(c.tab)}
            style={{
              background: `${c.color}10`, border: `1px solid ${c.color}30`,
              borderRadius: 10, padding: '12px', textAlign: 'left',
              color: 'var(--text)', cursor: 'pointer',
            }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* ── Active mission card ── */}
      {activeInc && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: '4px solid var(--critical)',
        }} className="rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">🚨 Current Active Mission</h3>
            <PriorityBadge priority={activeInc.priority} />
          </div>
          <div className="px-4 py-3 rounded-xl mb-3 text-sm flex gap-2"
            style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)' }}>
            ℹ️ <span style={{ color: 'var(--muted)' }}>
              {activeInc.title} — ETA:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {activeInc.eta > 0 ? `${activeInc.eta} min` : 'On site'}
              </strong>
              {distToMission !== null && (
                <span style={{ marginLeft: 10, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--blue)' }}>
                  · {distToMission.toFixed(1)} km away
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            {[
              ['Location', activeInc.location],
              ['Category', activeInc.category],
              ['Priority', activeInc.priority],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{k}</div>
                <div className="font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {['Mark In Progress', 'Open Navigation', 'Complete Mission'].map((label, i) => (
              <button key={label}
                onClick={() => {
                  if (i === 1 && activeInc.lat && activeInc.lng) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeInc.lat},${activeInc.lng}`, '_blank');
                  } else {
                    notify(`${label} ✅`, 'success');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold transition"
                style={{
                  background: ['rgba(34,197,94,.15)', 'rgba(59,130,246,.15)', 'rgba(239,68,68,.15)'][i],
                  color: ['#86EFAC', '#93C5FD', '#FCA5A5'][i],
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Nearby incidents ranked by distance ── */}
      {myTeam?.lat && incidents.filter(i => i.status !== 'Resolved' && i.lat).length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-sm mb-3">📊 Nearby Active Incidents</h3>
          {incidents
            .filter(i => i.status !== 'Resolved' && i.lat && i.lng)
            .map(inc => ({
              ...inc,
              distKm: haversine(myTeam.lat, myTeam.lng, inc.lat, inc.lng),
              eta: calculateETA(haversine(myTeam.lat, myTeam.lng, inc.lat, inc.lng)),
            }))
            .sort((a, b) => a.distKm - b.distKm)
            .slice(0, 5)
            .map((inc, idx) => (
              <div key={inc.id}
                className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: idx === 0 ? 'rgba(255,45,45,.2)' : 'rgba(53,199,255,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: idx === 0 ? 'var(--critical)' : 'var(--blue)',
                  fontFamily: 'JetBrains Mono',
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{inc.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{inc.location}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--blue)' }}>
                    {inc.distKm.toFixed(1)} km
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--orange)' }}>~{inc.eta} min ETA</div>
                </div>
                <PriorityBadge priority={inc.priority} />
              </div>
            ))}
        </div>
      )}

      {/* ── Notifications ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        className="rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3">🔔 Notifications</h3>
        {(notifs.length > 0 ? notifs : [
          { message: 'New mission assigned: Vehicle fire on Mumbai-Pune Expressway', type: 'info' },
          { message: 'Weather alert: Heavy rain expected in Pune zone', type: 'warning' },
          { message: 'Previous mission #6 resolved successfully', type: 'success' },
        ]).slice(0, 5).map((n, i) => (
          <div key={n.id || i} className="flex gap-2 py-2.5 text-sm border-b last:border-b-0"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <span>{n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Assigned Cases ────────────────────────────────────────────────────────────
function AssignedCases({ myTeam }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    db.getIncidents()
      .then(data => {
        const myTeamName = myTeam?.name || 'Fire Team A';
        setIncidents(data.filter(i =>
          i.assignedTeam?.toLowerCase() === myTeamName.toLowerCase() &&
          i.status !== 'Resolved'
        ));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [myTeam?.name]);

  const colors = { P1: '#EF4444', P2: '#F97316', P3: '#EAB308', P4: '#22C55E' };

  return (
    <div>
      <h2 className="font-bold text-base mb-5">Assigned Cases ({incidents.length})</h2>
      {loading && <div className="text-center py-10 text-sm text-slate-500">Loading…</div>}
      {!loading && incidents.length === 0 && (
        <div className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>No active assignments!</div>
      )}
      {incidents.map(i => {
        const distKm = (myTeam?.lat && i.lat)
          ? haversine(myTeam.lat, myTeam.lng, i.lat, i.lng)
          : null;
        const eta = distKm !== null ? calculateETA(distKm) : (i.eta || 0);
        return (
          <div key={i.id}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: `4px solid ${colors[i.priority]}`,
            }}
            className="rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-sm">#{i.id} — {i.title}</div>
              <PriorityBadge priority={i.priority} />
            </div>
            <div className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {(i.description || '').slice(0, 120)}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs mb-4">
              {[
                ['Location', i.location],
                ['Distance', distKm !== null ? `${distKm.toFixed(1)} km` : '—'],
                ['ETA', eta > 0 ? `~${eta} min` : 'On site'],
              ].map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: 'var(--muted)' }}>{k}: </span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  db.updateIncidentStatus(i.id, 'In Progress');
                  notify(`Incident #${i.id} → In Progress`, 'success');
                  setIncidents(prev => prev.filter(inc => inc.id !== i.id));
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(34,197,94,.15)', color: '#86EFAC' }}>
                ▶ In Progress
              </button>
              <button
                onClick={() => {
                  if (i.lat && i.lng) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}`, '_blank');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(53,199,255,.15)', color: '#93C5FD' }}>
                🗺️ Navigate
              </button>
              <button
                onClick={() => {
                  db.updateIncidentStatus(i.id, 'Resolved');
                  notify(`Incident #${i.id} Resolved ✅`, 'success');
                  setIncidents(prev => prev.filter(inc => inc.id !== i.id));
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(239,68,68,.15)', color: '#FCA5A5' }}>
                ✅ Mark Resolved
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Team Status ──────────────────────────────────────────────────────────────
function TeamStatus({ user, myTeam }) {
  const [current, setCurrent] = useState('On Route');
  const [members, setMembers] = useState([]);
  useEffect(() => { db.getTeamMembers(1).then(setMembers).catch(() => {}); }, []);

  const STATUSES = ['Available', 'Busy', 'On Route', 'Emergency Mode'];
  return (
    <div>
      <h2 className="font-bold text-base mb-5">Team Status</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        className="rounded-xl p-5 mb-4">
        <h3 className="font-semibold text-sm mb-4">Update Your Team Status</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {STATUSES.map(s => (
            <button key={s}
              onClick={async () => {
                setCurrent(s);
                if (myTeam?.id) {
                  await db.updateTeamStatus(myTeam.id, s);
                }
                notify(`Status → ${s}`, 'success');
              }}
              className="py-3 rounded-xl text-sm font-bold transition"
              style={{
                background: current === s ? 'var(--critical)' : 'var(--surface2)',
                color: current === s ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
              }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{
          background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)',
          borderRadius: 8, padding: '10px 12px', fontSize: 12,
        }}>
          Team: <strong>{myTeam?.name || '—'}</strong> · Status: <strong>{current}</strong>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        className="rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4">Team Members ({members.length || 6})</h3>
        {(members.length ? members : [
          'Rajan P.', 'Suresh K.', 'Amit S.', 'Pradeep M.', 'Vijay T.', 'Mahesh R.',
        ].map((name, i) => ({ id: i, name, grade: i < 2 ? 'Grade A' : 'Grade B', status: 'Active' }))).map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
            style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(59,130,246,.15)', color: '#93C5FD' }}>
              {(m.name || '?').charAt(0)}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.grade}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(34,197,94,.2)', color: '#86EFAC' }}>
              {m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main RescueDashboard ──────────────────────────────────────────────────────
export default function RescueDashboard() {
  const { user } = useAuth();
  const [tab, setTab]       = useState('overview');
  const [myTeam, setMyTeam] = useState(null);

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <Sidebar items={SIDEBAR} activeTab={tab} onTabChange={setTab}
        header={{ label: 'Rescue Portal', name: user?.name }} />
      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'overview'  && <Overview user={user} setTab={setTab} myTeam={myTeam} setMyTeam={setMyTeam} />}
        {tab === 'assigned'  && <AssignedCases myTeam={myTeam} />}
        {tab === 'tracking'  && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
              📍 Live Tracking — All Units
            </h2>
            {!myTeam?.lat && (
              <div style={{
                background: 'rgba(255,107,26,.08)', border: '1px solid rgba(255,107,26,.25)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12,
                color: 'var(--orange)',
              }}>
                ⚠️ Your base location hasn't been set yet. Go to <strong>Team Dashboard</strong> to activate GPS.
              </div>
            )}
            <LiveTrackingMap height={500} userRole="rescue_team" myBaseTeam={myTeam} />
          </div>
        )}
        {tab === 'disaster'  && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
              🗺️ Live Disaster Heatmap
            </h2>
            <DisasterHeatmap height={500} />
          </div>
        )}
        {tab === 'weather'   && (
          <div>
            <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
              ⛈️ Weather Map — Operating Zone
            </h2>
            <WeatherHeatmap height={440} />
          </div>
        )}
        {tab === 'missions'  && (
          <div>
            <h2 className="font-bold text-base mb-5">Completed Missions</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm">#6 — Waterlogging Kothrud</div>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(100,116,139,.2)', color: '#94A3B8' }}>P4</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[['Location', 'Kothrud'], ['Category', 'Flood'], ['Duration', '2h 30m']].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: 'var(--muted)' }}>{k}</div>
                    <div>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{
                background: 'rgba(34,197,94,.1)', color: '#86EFAC',
                borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 10,
              }}>✅ Mission completed</div>
            </div>
          </div>
        )}
        {tab === 'status'    && <TeamStatus user={user} myTeam={myTeam} />}
      </main>
    </div>
  );
}
