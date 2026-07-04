/**
 * LiveTrackingMap — real-time rescue team locations + incident markers.
 * - For citizens: shows only their assigned team.
 * - For authority/rescue: shows all teams + incidents.
 * - NEW: Accepts `myBaseTeam` prop — renders a special Home/Base pin
 *        for the logged-in rescue team and draws route lines to active incidents.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseReady } from '../../utils/supabase';
import { db } from '../../utils/db';
import { haversine, calculateETA } from '../../utils/aiEngine';

const PUNE = [18.5204, 73.8567];
const P_COLORS = { P1: '#FF2D2D', P2: '#FF6B1A', P3: '#F5C518', P4: '#00E676' };

function teamColor(status) {
  return status === 'Available' ? '#00E676' : status === 'On Route' ? '#FF6B1A' : '#FF2D2D';
}



// ── Team avatar circle icon ────────────────────────────────────────────────────
function makeTeamIcon(L, team) {
  const color   = teamColor(team.status);
  const initial = team.name.charAt(0);
  const anim    = team.status === 'Available' ? 'breathe-green' : team.status === 'On Route' ? 'breathe-orange' : 'breathe-red';
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;background:${color};border:2px solid rgba(255,255,255,.75);border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#000;
      box-shadow:0 0 14px ${color}99;animation:${anim} 2s infinite">${initial}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
  });
}

// ── Rescue Base (Home) pin icon ────────────────────────────────────────────────
function makeBaseIcon(L, teamName) {
  const initials = teamName ? teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'B';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:44px;height:52px">
      <!-- House icon -->
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#1a2f5a,#0d1e3f);
        border:2.5px solid #35c7ff;border-radius:10px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:2px;
        box-shadow:0 0 20px rgba(53,199,255,.5),0 0 6px rgba(53,199,255,.8)">
        <span style="font-size:18px">🏠</span>
        <span style="font-size:8px;font-weight:700;color:#35c7ff;font-family:JetBrains Mono,monospace;
          letter-spacing:.04em;line-height:1">${initials}</span>
      </div>
      <!-- Anchor dot -->
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:8px;height:8px;border-radius:50%;background:#35c7ff;
        box-shadow:0 0 6px #35c7ff"></div>
    </div>`,
    iconSize: [44, 52], iconAnchor: [22, 52],
  });
}

export default function LiveTrackingMap({
  height = 420,
  userRole = 'authority',
  assignedTeam = null,   // citizen: team name string
  incidentId   = null,   // citizen: their incident id
  myBaseTeam   = null,   // rescue: the logged-in team object with { lat, lng, name, ... }
}) {
  const mapRef     = useRef(null);
  const mapInst    = useRef(null);
  const markersRef = useRef({});
  const linesRef   = useRef([]);
  const baseRef    = useRef(null);

  const [teams,     setTeams]     = useState([]);
  const [incidents, setIncidents] = useState([]);

  // ── Load initial data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [t, i] = await Promise.all([db.getTeams(), db.getIncidents()]);
      setTeams(t);
      setIncidents(i);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('live-tracking-v2')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rescue_teams' }, payload => {
        setTeams(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async () => {
        try { setIncidents(await db.getIncidents()); } catch {}
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(PUNE, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  // ── Render markers & route lines ───────────────────────────────────────────
  useEffect(() => {
    const L   = window.L;
    const map = mapInst.current;
    if (!L || !map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
    markersRef.current = {};

    // Clear old route lines
    linesRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    linesRef.current = [];

    // Remove old base pin
    if (baseRef.current) { try { map.removeLayer(baseRef.current); } catch {} baseRef.current = null; }

    const activeIncidents = incidents.filter(i => i.status !== 'Resolved');
    const allPoints       = [];

    // ── Incident markers ──────────────────────────────────────────────────
    activeIncidents.forEach(inc => {
      if (!inc.lat || !inc.lng) return;
      if (userRole === 'citizen' && incidentId && inc.id !== incidentId) return;

      const color  = P_COLORS[inc.priority] || '#94A3B8';
      const distTxt = (myBaseTeam?.lat && inc.lat)
        ? `<br/>📍 ${haversine(myBaseTeam.lat, myBaseTeam.lng, inc.lat, inc.lng).toFixed(1)} km · ~${calculateETA(haversine(myBaseTeam.lat, myBaseTeam.lng, inc.lat, inc.lng))} min ETA`
        : '';
      const marker = L.circleMarker([inc.lat, inc.lng], {
        radius: 13, fillColor: color, color: '#fff', weight: 2.5, opacity: 1, fillOpacity: 0.88,
      }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;padding:4px;min-width:180px">
          <b style="font-size:13px">#${inc.id} — ${inc.title}</b><br/>
          ${inc.category} · <span style="color:${color};font-weight:700">${inc.priority}</span><br/>
          Status: ${inc.status}<br/>
          Team: ${inc.assignedTeam || '—'}${distTxt}
        </div>`
      );
      markersRef.current[`inc-${inc.id}`] = marker;
      allPoints.push([inc.lat, inc.lng]);

      // Draw dashed route line from base to incident
      if (myBaseTeam?.lat && myBaseTeam?.lng) {
        const line = L.polyline(
          [[myBaseTeam.lat, myBaseTeam.lng], [inc.lat, inc.lng]],
          { color, weight: 2, opacity: 0.5, dashArray: '6 4' }
        ).addTo(map);
        linesRef.current.push(line);
      }
    });

    // ── Team markers ──────────────────────────────────────────────────────
    const visibleTeams = userRole === 'citizen'
      ? teams.filter(t => t.name === assignedTeam)
      : teams;

    visibleTeams.forEach(team => {
      if (!team.lat || !team.lng) return;
      const marker = L.marker([team.lat, team.lng], { icon: makeTeamIcon(L, team) }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;padding:4px">
          <b>${team.name}</b><br/>
          ${team.type} · ${team.members} members<br/>
          Status: <span style="color:${teamColor(team.status)};font-weight:700">${team.status}</span>
        </div>`
      );
      markersRef.current[`team-${team.id}`] = marker;
      allPoints.push([team.lat, team.lng]);
    });

    // ── Rescue Base (Home) pin ─────────────────────────────────────────────
    if (myBaseTeam?.lat && myBaseTeam?.lng) {
      const basePin = L.marker([myBaseTeam.lat, myBaseTeam.lng], {
        icon: makeBaseIcon(L, myBaseTeam.name || 'Base'),
        zIndexOffset: 1000,
      }).addTo(map);
      basePin.bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;padding:4px">
          <b>🏠 ${myBaseTeam.name || 'Rescue Base'}</b><br/>
          <span style="color:#35c7ff">BASE LOCATION</span><br/>
          ${myBaseTeam.type || ''} · ${myBaseTeam.members || 0} members<br/>
          Lat: ${myBaseTeam.lat.toFixed(5)}<br/>
          Lng: ${myBaseTeam.lng.toFixed(5)}
        </div>`
      );
      basePin.openPopup();
      baseRef.current = basePin;
      allPoints.push([myBaseTeam.lat, myBaseTeam.lng]);
    }

    // ── Fit map to show all markers ─────────────────────────────────────────
    if (allPoints.length > 1) {
      try { map.fitBounds(allPoints, { padding: [50, 50] }); } catch {}
    } else if (allPoints.length === 1) {
      map.setView(allPoints[0], 14);
    }
  }, [teams, incidents, userRole, assignedTeam, incidentId, myBaseTeam]);

  const activePx = teams.filter(t => t.status !== 'Available').length;

  return (
    <div>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { label: 'LIVE TRACKING', val: `${teams.length} TEAMS`, color: 'var(--blue)'     },
          { label: 'DEPLOYED',      val: activePx,                color: 'var(--orange)'   },
          { label: 'AVAILABLE',     val: teams.filter(t => t.status === 'Available').length, color: 'var(--safe)'    },
          { label: 'ACTIVE INC.',   val: incidents.filter(i => i.status !== 'Resolved').length, color: 'var(--critical)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(23,33,58,.6)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 10px',
          }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
        {myBaseTeam?.lat && (
          <div style={{
            background: 'rgba(53,199,255,.08)', border: '1px solid rgba(53,199,255,.3)',
            borderRadius: 6, padding: '5px 10px',
          }}>
            <div className="eyebrow" style={{ marginBottom: 2, color: 'rgba(53,199,255,.7)' }}>BASE SET</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#35c7ff' }}>
              {myBaseTeam.name}
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--safe)', fontFamily: 'JetBrains Mono' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', animation: 'breathe-green 1.5s infinite' }} />
          LIVE
        </div>
      </div>

      <div ref={mapRef} style={{
        height, borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border)', position: 'relative',
      }} />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {[
          ['#FF2D2D', 'P1 Critical'],
          ['#FF6B1A', 'P2 High'],
          ['#F5C518', 'P3 Medium'],
          ['#00E676', 'Available Team'],
          ['#FF6B1A', 'On Route'],
          ['#35c7ff', '🏠 Rescue Base'],
        ].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
