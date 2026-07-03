/**
 * AutoDispatchEngine
 * ==================
 * An AI-powered monitoring widget for the Rescue Team Dashboard.
 *
 * Behaviour:
 *  1. Watches Supabase Realtime for unassigned incidents (status = 'Reported').
 *  2. Ranks them by a composite severity score:
 *       • Priority weight  (P1=100 | P2=70 | P3=40 | P4=20)
 *       • Distance bonus   (close incidents score higher)
 *       • Keyword urgency  ("trapped", "multiple", "collapse", …)
 *       • Age bonus        (+2/min for every minute unattended)
 *  3. Shows each candidate with a countdown timer:
 *       • P1  → 30 seconds  (critical — no time to waste)
 *       • P2  → 2 minutes
 *       • P3  → 5 minutes
 *       • P4  → 10 minutes
 *  4. When the countdown hits 0, it AUTO-ASSIGNS the team and marks the
 *     team's Supabase row as "On Route".
 *  5. The rescue team can also click "ACCEPT NOW" to self-assign immediately,
 *     or "DISMISS" to skip this incident (it won't be offered again from this engine).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseReady } from '../utils/supabase';
import { db } from '../utils/db';
import { notify } from './Notification';
import { haversine, calculateETA } from '../utils/aiEngine';

// ─── Priority countdown times (seconds) ──────────────────────────────────────
const COUNTDOWN_TIMES = { P1: 30, P2: 120, P3: 300, P4: 600 };

// ─── Priority weight scores ───────────────────────────────────────────────────
const PRIORITY_WEIGHT = { P1: 100, P2: 70, P3: 40, P4: 20 };

// ─── High-urgency keywords ────────────────────────────────────────────────────
const URGENT_KEYWORDS = [
  'trapped', 'multiple', 'mass casualty', 'collapse', 'collapsed', 'unconscious',
  'dying', 'critical', 'life threatening', 'stranded', 'rising', 'spreading fast',
  'children', 'elderly', 'hospital', 'explosion', 'gas leak',
];

// ─── Category icons ───────────────────────────────────────────────────────────
const CAT_ICON = {
  'Flood': '🌊', 'Fire': '🔥', 'Road Accident': '🚗',
  'Medical Emergency': '🚑', 'Building Collapse': '🏚️', 'Unknown': '⚡',
};

// ─── Severity analyser ────────────────────────────────────────────────────────
function analyzeSeverity(inc, teamLat, teamLng) {
  let score = PRIORITY_WEIGHT[inc.priority] || 40;

  // Keyword urgency
  const text = ((inc.title || '') + ' ' + (inc.description || '')).toLowerCase();
  const matchedKeywords = URGENT_KEYWORDS.filter(kw => text.includes(kw));
  score += matchedKeywords.length * 8;

  // Distance bonus: closer = higher urgency
  let distKm = null;
  let etaMin = null;
  if (teamLat && teamLng && inc.lat && inc.lng) {
    distKm = haversine(teamLat, teamLng, inc.lat, inc.lng);
    etaMin = calculateETA(distKm);
    if (distKm < 2)      score += 20;
    else if (distKm < 5) score += 12;
    else if (distKm < 10) score += 6;
  }

  // Age bonus: every 5 min unattended adds +5
  const ageMin = (Date.now() - new Date(inc.created_at).getTime()) / 60000;
  score += Math.floor(ageMin / 5) * 5;

  // Severity label
  let label, color;
  if (score >= 120)      { label = 'CRITICAL';  color = '#FF2D2D'; }
  else if (score >= 90)  { label = 'SEVERE';    color = '#FF6B1A'; }
  else if (score >= 60)  { label = 'HIGH';      color = '#F5C518'; }
  else                   { label = 'MODERATE';  color = '#25e6a3'; }

  return { score, label, color, matchedKeywords, distKm, etaMin };
}

// ─── Single incident alert card with countdown ────────────────────────────────
function IncidentAlert({ inc, team, onAccept, onDismiss }) {
  const severity  = analyzeSeverity(inc, team?.lat, team?.lng);
  const maxTime   = COUNTDOWN_TIMES[inc.priority] || 120;
  const [secs, setSecs]         = useState(maxTime);
  const [autoFired, setAutoFired] = useState(false);
  const timerRef  = useRef(null);

  // Countdown tick
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoFired) {
            setAutoFired(true);
            onAccept(inc, severity, true); // true = auto-assigned
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = ((maxTime - secs) / maxTime) * 100;

  // Urgency pulse for low remaining time
  const isUrgent   = secs <= 30;
  const isCritical = secs <= 10;

  const fmt = (s) => s >= 60
    ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    : `${s}s`;

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(16,25,46,.98), rgba(10,16,32,.97))',
      border: `1px solid ${severity.color}44`,
      borderLeft: `4px solid ${severity.color}`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
      animation: isCritical ? 'breathe-red 0.6s infinite' : undefined,
      boxShadow: `0 4px 24px ${severity.color}22`,
    }}>
      {/* ── Progress bar (depletes as countdown ticks down) ── */}
      <div style={{ height: 3, background: 'rgba(255,255,255,.06)' }}>
        <div style={{
          height: '100%',
          width: `${100 - pct}%`,
          background: `linear-gradient(90deg, ${severity.color}, ${severity.color}88)`,
          transition: 'width 1s linear',
        }} />
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{CAT_ICON[inc.category] || '⚡'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>
                #{inc.id} — {inc.title}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
                {inc.category} · {inc.location}
              </div>
            </div>
          </div>

          {/* ── Countdown timer ── */}
          <div style={{
            flexShrink: 0, marginLeft: 12,
            background: isUrgent ? `${severity.color}20` : 'rgba(255,255,255,.04)',
            border: `1px solid ${isUrgent ? severity.color : 'var(--border)'}`,
            borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 64,
          }}>
            <div style={{
              fontSize: 9, fontFamily: 'JetBrains Mono', letterSpacing: '.08em',
              color: isUrgent ? severity.color : 'var(--muted)', marginBottom: 2,
            }}>
              {secs === 0 ? 'AUTO-ASSIGNING' : 'AUTO IN'}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono',
              color: isUrgent ? severity.color : 'var(--text)',
            }}>
              {secs === 0 ? '🚒' : fmt(secs)}
            </div>
          </div>
        </div>

        {/* ── Severity + Distance row ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {/* Priority badge */}
          <span style={{
            fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono',
            background: `${severity.color}20`, color: severity.color,
            border: `1px solid ${severity.color}44`, borderRadius: 9999, padding: '3px 8px',
          }}>
            {inc.priority}
          </span>
          {/* Severity */}
          <span style={{
            fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono',
            background: `${severity.color}15`, color: severity.color,
            border: `1px solid ${severity.color}33`, borderRadius: 9999, padding: '3px 8px',
          }}>
            ⚠ {severity.label} · Score {severity.score}
          </span>
          {/* Distance */}
          {severity.distKm !== null && (
            <span style={{
              fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700,
              background: 'rgba(53,199,255,.1)', color: 'var(--blue)',
              border: '1px solid rgba(53,199,255,.25)', borderRadius: 9999, padding: '3px 8px',
            }}>
              📍 {severity.distKm.toFixed(1)} km · ~{severity.etaMin} min
            </span>
          )}
        </div>

        {/* ── Severity analysis ── */}
        <div style={{
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11,
        }}>
          <div style={{
            fontSize: 9, fontFamily: 'JetBrains Mono', letterSpacing: '.1em',
            color: 'var(--muted)', marginBottom: 6,
          }}>
            AI SEVERITY ANALYSIS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['Priority weight', PRIORITY_WEIGHT[inc.priority] || 0],
              ['Keyword flags',   severity.matchedKeywords.length * 8],
              ['Distance score',  severity.distKm !== null ? (severity.distKm < 2 ? 20 : severity.distKm < 5 ? 12 : severity.distKm < 10 ? 6 : 0) : 0],
              ['Age urgency',     Math.floor(((Date.now() - new Date(inc.created_at).getTime()) / 60000) / 5) * 5],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>{k}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
                  color: v > 0 ? severity.color : 'var(--muted)',
                }}>+{v}</span>
              </div>
            ))}
          </div>
          {severity.matchedKeywords.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--orange)' }}>
              🚨 Urgency keywords: {severity.matchedKeywords.slice(0, 4).join(', ')}
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onAccept(inc, severity, false)}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: `linear-gradient(135deg, ${severity.color}30, ${severity.color}18)`,
              border: `1px solid ${severity.color}55`,
              color: severity.color, fontWeight: 800, fontSize: 12,
              fontFamily: 'JetBrains Mono', cursor: 'pointer',
              letterSpacing: '.04em',
            }}>
            🚒 ACCEPT MISSION
          </button>
          <button
            onClick={() => onDismiss(inc.id)}
            style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.1)',
              color: 'var(--muted)', fontSize: 11, cursor: 'pointer',
            }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AutoDispatchEngine component ───────────────────────────────────────
export default function AutoDispatchEngine({ team }) {
  const [candidates, setCandidates] = useState([]);  // unassigned incidents
  const [dismissed, setDismissed]   = useState(new Set()); // IDs we've dismissed
  const [assigned, setAssigned]     = useState([]);  // recently auto/manually assigned
  const [collapsed, setCollapsed]   = useState(false);

  // ── Load unassigned incidents ──────────────────────────────────────────────
  const loadCandidates = useCallback(async () => {
    try {
      const all = await db.getIncidents();
      setCandidates(prev => {
        const dismissedIds = dismissed;
        return all
          .filter(i =>
            (i.status === 'Reported' || !i.assignedTeam) &&
            i.status !== 'Resolved' &&
            !dismissedIds.has(i.id)
          )
          .sort((a, b) => {
            const sA = analyzeSeverity(a, team?.lat, team?.lng).score;
            const sB = analyzeSeverity(b, team?.lat, team?.lng).score;
            return sB - sA; // highest severity first
          });
      });
    } catch (_) {}
  }, [team?.lat, team?.lng, dismissed]);

  useEffect(() => {
    loadCandidates();
    const interval = setInterval(loadCandidates, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadCandidates]);

  // ── Supabase Realtime: watch for new incidents ────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady) return;
    const ch = supabase.channel('auto-dispatch-engine')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        if (inc.status === 'Reported' && !inc.assigned_team) {
          // Normalize the new incident
          const normalized = {
            id: inc.id,
            title: inc.title,
            description: inc.description,
            category: inc.category,
            priority: inc.priority,
            status: inc.status,
            location: inc.location,
            lat: inc.lat,
            lng: inc.lng,
            assignedTeam: inc.assigned_team,
            created_at: inc.created_at,
            eta: inc.eta,
          };
          notify(`🆕 New unassigned ${inc.priority} incident: "${inc.title}"`, 'disaster');
          setCandidates(prev => {
            if (prev.find(c => c.id === inc.id)) return prev;
            return [normalized, ...prev].sort((a, b) =>
              analyzeSeverity(b, team?.lat, team?.lng).score -
              analyzeSeverity(a, team?.lat, team?.lng).score
            );
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, payload => {
        const inc = payload.new;
        // Remove from candidates if now assigned or resolved
        if (inc.assigned_team || inc.status === 'Resolved' || inc.status === 'Assigned') {
          setCandidates(prev => prev.filter(c => c.id !== inc.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [team?.lat, team?.lng]);

  // ── Accept handler (manual or auto) ───────────────────────────────────────
  const handleAccept = useCallback(async (inc, severity, isAuto) => {
    if (!team) {
      notify('⚠️ Set your base location first before accepting missions', 'warning');
      return;
    }
    try {
      await db.assignIncidentToTeam(inc.id, team.id, team.name, severity.etaMin || 0);
      const label = isAuto ? '🤖 AUTO-ASSIGNED' : '✅ ACCEPTED';
      notify(
        `${label}: "${inc.title}" → ${team.name} · ETA ~${severity.etaMin || '?'} min`,
        'rescue'
      );
      setCandidates(prev => prev.filter(c => c.id !== inc.id));
      setAssigned(prev => [
        { ...inc, isAuto, assignedAt: new Date(), eta: severity.etaMin, severity },
        ...prev.slice(0, 4), // keep last 5
      ]);
    } catch (err) {
      notify(`❌ Could not assign: ${err.message}`, 'error');
    }
  }, [team]);

  // ── Dismiss handler ────────────────────────────────────────────────────────
  const handleDismiss = useCallback((incId) => {
    setDismissed(prev => new Set([...prev, incId]));
    setCandidates(prev => prev.filter(c => c.id !== incId));
  }, []);

  // ── If team hasn't set base, show locked state ────────────────────────────
  if (!team?.id) return null;

  const activeCount = candidates.length;

  return (
    <div style={{
      background: activeCount > 0
        ? 'linear-gradient(145deg,rgba(20,12,12,.98),rgba(16,8,8,.97))'
        : 'var(--surface)',
      border: `1px solid ${activeCount > 0 ? 'rgba(255,77,94,.35)' : 'var(--border)'}`,
      borderRadius: 14,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* ── Engine Header ── */}
      <div style={{
        padding: '13px 18px',
        background: activeCount > 0
          ? 'linear-gradient(90deg,rgba(255,45,94,.12),rgba(255,107,26,.06))'
          : 'rgba(255,255,255,.02)',
        borderBottom: `1px solid ${activeCount > 0 ? 'rgba(255,77,94,.25)' : 'rgba(255,255,255,.06)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
      }}
        onClick={() => setCollapsed(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: activeCount > 0 ? 'rgba(255,45,94,.2)' : 'rgba(53,199,255,.1)',
            border: `1px solid ${activeCount > 0 ? 'rgba(255,45,94,.4)' : 'rgba(53,199,255,.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            🤖
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Rajdhani', letterSpacing: '.04em' }}>
              AI AUTO-DISPATCH ENGINE
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'JetBrains Mono', letterSpacing: '.08em' }}>
              SEVERITY ANALYSER · PROXIMITY MONITOR · AUTO-ASSIGN
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeCount > 0 && (
            <div style={{
              background: 'rgba(255,45,94,.25)', border: '1px solid rgba(255,45,94,.45)',
              borderRadius: 9999, padding: '4px 12px',
              fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#ff4d5e',
              animation: 'breathe-red 1.2s infinite',
            }}>
              {activeCount} PENDING
            </div>
          )}
          {activeCount === 0 && (
            <div style={{
              background: 'rgba(37,230,163,.1)', border: '1px solid rgba(37,230,163,.3)',
              borderRadius: 9999, padding: '4px 12px',
              fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#25e6a3',
            }}>
              ✓ ALL CLEAR
            </div>
          )}
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{collapsed ? '▼' : '▲'}</div>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 16px 4px' }}>
          {/* ── Status line ── */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            {[
              { label: 'TEAM', val: team.name, color: 'var(--blue)' },
              { label: 'BASE SET', val: team.lat ? 'YES' : 'NO', color: team.lat ? 'var(--safe)' : 'var(--orange)' },
              { label: 'MONITORING', val: 'ACTIVE', color: 'var(--safe)' },
              { label: 'AUTO-ASSIGNED', val: assigned.length, color: 'var(--orange)' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 6, padding: '5px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'JetBrains Mono', color: 'var(--muted)', letterSpacing: '.1em', marginBottom: 2 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono', color: s.color }}>
                  {s.val}
                </div>
              </div>
            ))}
          </div>

          {/* ── No pending ── */}
          {activeCount === 0 && assigned.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '20px 0 14px',
              color: 'var(--muted)', fontSize: 12,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
              Engine active — monitoring for unassigned incidents near {team.name}
            </div>
          )}

          {/* ── Candidate incident cards ── */}
          {candidates.map(inc => (
            <IncidentAlert
              key={inc.id}
              inc={inc}
              team={team}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          ))}

          {/* ── Recently auto-assigned log ── */}
          {assigned.length > 0 && (
            <div style={{ marginTop: 4, marginBottom: 12 }}>
              <div style={{
                fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--muted)',
                letterSpacing: '.1em', marginBottom: 8,
              }}>
                RECENT ASSIGNMENTS
              </div>
              {assigned.map((a, idx) => (
                <div key={`${a.id}-${idx}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', marginBottom: 4, borderRadius: 8,
                  background: 'rgba(37,230,163,.06)', border: '1px solid rgba(37,230,163,.15)',
                  fontSize: 11,
                }}>
                  <span>{a.isAuto ? '🤖' : '✅'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>#{a.id} {a.title}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                      {a.isAuto ? 'Auto-assigned' : 'Accepted'} · ETA ~{a.eta} min
                    </span>
                  </div>
                  <span style={{ color: '#25e6a3', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                    {a.severity?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
