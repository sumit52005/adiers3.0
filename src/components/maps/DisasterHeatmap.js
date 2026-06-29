/**
 * DisasterHeatmap — existing incident map, enhanced with pulsing markers.
 * Used across all three dashboards.
 */
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../../utils/db';
import { supabase, isSupabaseReady } from '../../utils/supabase';

const PUNE   = [18.5204, 73.8567];
const P_CLR  = { P1: '#FF2D2D', P2: '#FF6B1A', P3: '#F5C518', P4: '#00E676' };

export default function DisasterHeatmap({ height = 380, readOnly = false }) {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const layerRef= useRef([]);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    db.getIncidents().then(setIncidents).catch(() => {});
  }, []);

  // Live updates
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('disaster-heatmap')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async () => {
        const data = await db.getIncidents();
        setIncidents(data);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Init map
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(mapRef.current, { zoomControl: !readOnly, attributionControl: false }).setView(PUNE, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [readOnly]);

  // Render markers on data change
  useEffect(() => {
    const L = window.L;
    const map = mapInst.current;
    if (!L || !map) return;

    // Clear previous layers
    layerRef.current.forEach(l => map.removeLayer(l));
    layerRef.current = [];

    incidents.forEach(inc => {
      if (!inc.lat || !inc.lng) return;
      const color   = inc.status === 'Resolved' ? '#475569' : (P_CLR[inc.priority] || '#94A3B8');
      const isPulse = inc.status !== 'Resolved' && inc.priority === 'P1';

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:18px;height:18px">
          <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.55);z-index:2${isPulse ? ';animation:critical-pulse 2s ease-in-out infinite' : ''}"></div>
          ${isPulse ? `<div style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${color};opacity:0;animation:ring-expand 2s ease-out infinite"></div>` : ''}
        </div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });

      const marker = L.marker([inc.lat, inc.lng], { icon }).addTo(map);
      marker.bindPopup(`<div style="font-family:Inter;font-size:12px;min-width:180px;padding:4px">
        <b>#${inc.id} — ${inc.title}</b><br/>
        <span style="color:#8291b2;font-size:11px">${inc.category} · ${inc.priority} · ${inc.status}</span><br/>
        Team: ${inc.assignedTeam || '—'}<br/>
        ${inc.eta > 0 ? `ETA: ${inc.eta} min` : 'On site'}
      </div>`);
      layerRef.current.push(marker);
    });
  }, [incidents]);

  const byPriority = p => incidents.filter(i => i.priority === p && i.status !== 'Resolved').length;

  return (
    <div>
      {/* Mini summary */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {[['P1','#FF2D2D'],['P2','#FF6B1A'],['P3','#F5C518'],['P4','#00E676']].map(([p,c]) => (
          <div key={p} style={{ background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontFamily: 'JetBrains Mono', color: c }}>
            {p}: {byPriority(p)}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--muted)' }}>
          {incidents.filter(i => i.status === 'Resolved').length} resolved · {incidents.length} total
        </div>
      </div>
      <div ref={mapRef} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} />
    </div>
  );
}
