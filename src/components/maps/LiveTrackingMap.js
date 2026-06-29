/**
 * LiveTrackingMap — shows real-time rescue team locations + incident markers.
 * Uses Supabase Realtime to push team location updates.
 * For citizens: shows only their assigned team.
 * For authority/rescue: shows all teams.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseReady } from '../../utils/supabase';
import { db } from '../../utils/db';

const PUNE = [18.5204, 73.8567];
const P_COLORS = { P1: '#FF2D2D', P2: '#FF6B1A', P3: '#F5C518', P4: '#00E676' };

function teamColor(status) {
  return status === 'Available' ? '#00E676' : status === 'On Route' ? '#FF6B1A' : '#FF2D2D';
}

function makePinIcon(L, color, pulse = true) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.6);z-index:2"></div>
      ${pulse ? `
        <div style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${color};opacity:0;animation:ring-expand 2s ease-out infinite"></div>
        <div style="position:absolute;inset:-13px;border-radius:50%;border:1.5px solid ${color};opacity:0;animation:ring-expand 2s ease-out .6s infinite"></div>` : ''}
    </div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

function makeTeamIcon(L, team) {
  const color = teamColor(team.status);
  const initial = team.name.charAt(0);
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:${color};border:2px solid rgba(255,255,255,.7);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#000;box-shadow:0 0 12px ${color}88;animation:breathe-${team.status==='Available'?'green':team.status==='On Route'?'orange':'red'} 2s infinite">${initial}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

export default function LiveTrackingMap({
  height = 420,
  userRole = 'authority',
  assignedTeam = null,  // for citizen view — team name
  incidentId = null,    // for citizen view — their incident
}) {
  const mapRef     = useRef(null);
  const mapInst    = useRef(null);
  const markersRef = useRef({});
  const [teams, setTeams]         = useState([]);
  const [incidents, setIncidents] = useState([]);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [t, i] = await Promise.all([db.getTeams(), db.getIncidents()]);
      setTeams(t);
      setIncidents(i);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Supabase Realtime — team location/status changes
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('live-tracking')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rescue_teams' }, payload => {
        setTeams(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async () => {
        try {
          const fresh = await db.getIncidents();
          setIncidents(fresh);
        } catch {}
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Init map
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(PUNE, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  // Render/update markers whenever data changes
  useEffect(() => {
    const L = window.L;
    const map = mapInst.current;
    if (!L || !map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Incident markers
    const visibleIncidents = incidents.filter(i => i.status !== 'Resolved');
    visibleIncidents.forEach(inc => {
      if (!inc.lat || !inc.lng) return;
      // Citizens only see their assigned incident
      if (userRole === 'citizen' && incidentId && inc.id !== incidentId) return;
      const color = P_COLORS[inc.priority] || '#94A3B8';
      const marker = L.circleMarker([inc.lat, inc.lng], {
        radius: 12, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85,
      }).addTo(map);
      marker.bindPopup(`<div style="font-family:Inter;font-size:12px;padding:4px"><b>#${inc.id} — ${inc.title}</b><br/>${inc.category} · ${inc.priority} · ${inc.status}<br/>Team: ${inc.assignedTeam || '—'}</div>`);
      markersRef.current[`inc-${inc.id}`] = marker;
    });

    // Team markers
    const visibleTeams = userRole === 'citizen'
      ? teams.filter(t => t.name === assignedTeam)
      : teams;
    visibleTeams.forEach(team => {
      if (!team.lat || !team.lng) return;
      const marker = L.marker([team.lat, team.lng], { icon: makeTeamIcon(L, team) }).addTo(map);
      marker.bindPopup(`<div style="font-family:Inter;font-size:12px;padding:4px"><b>${team.name}</b><br/>${team.type} · ${team.members} members · ${team.status}</div>`);
      markersRef.current[`team-${team.id}`] = marker;
    });

    // Fit bounds
    const allPoints = [
      ...visibleIncidents.filter(i => i.lat).map(i => [i.lat, i.lng]),
      ...visibleTeams.filter(t => t.lat).map(t => [t.lat, t.lng]),
    ];
    if (allPoints.length > 1) {
      try { map.fitBounds(allPoints, { padding: [40, 40] }); } catch {}
    }
  }, [teams, incidents, userRole, assignedTeam, incidentId]);

  // Legend for authority/rescue
  const activePx = teams.filter(t => t.status !== 'Available').length;

  return (
    <div>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { label: 'LIVE TRACKING', val: `${teams.length} TEAMS`, color: 'var(--blue)' },
          { label: 'DEPLOYED', val: activePx, color: 'var(--orange)' },
          { label: 'AVAILABLE', val: teams.filter(t => t.status === 'Available').length, color: 'var(--safe)' },
          { label: 'ACTIVE INC.', val: incidents.filter(i => i.status !== 'Resolved').length, color: 'var(--critical)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(23,33,58,.6)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--safe)', fontFamily: 'JetBrains Mono' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', animation: 'breathe-green 1.5s infinite' }} />
          LIVE
        </div>
      </div>

      <div ref={mapRef} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }} />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {[['#FF2D2D','P1 Critical'],['#FF6B1A','P2 High'],['#F5C518','P3 Medium'],['#00E676','Available Team'],['#FF6B1A','On Route'],['#FF2D2D','Busy Team']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}
