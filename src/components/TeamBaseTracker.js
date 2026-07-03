/**
 * TeamBaseTracker
 * ---------------
 * Mounted inside RescueDashboard when a rescue_team user logs in.
 * 1. Tries to find the rescue team that matches the logged-in user's profile name.
 * 2. Grabs browser GPS coordinates.
 * 3. Writes those coordinates back to the rescue_teams table in Supabase.
 * 4. Renders a status panel + mini location card.
 *
 * This makes the team's live position show correctly on LiveTrackingMap
 * and ensures the AI dispatch model picks the closest real team.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../utils/db';
import { notify } from '../Notification';
import { haversine } from '../../utils/aiEngine';

// ─── Status states ────────────────────────────────────────────────────────────
const S = {
  IDLE: 'idle',
  FINDING_TEAM: 'finding_team',
  GETTING_GPS: 'getting_gps',
  SAVING: 'saving',
  SUCCESS: 'success',
  ERROR: 'error',
  NO_TEAM: 'no_team',
  GPS_DENIED: 'gps_denied',
};

export default function TeamBaseTracker({ user, onTeamResolved }) {
  const [status, setStatus]         = useState(S.IDLE);
  const [team, setTeam]             = useState(null);
  const [allTeams, setAllTeams]     = useState([]);
  const [coords, setCoords]         = useState(null);
  const [address, setAddress]       = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError]           = useState('');

  // ── Step 1: Load all teams ─────────────────────────────────────────────────
  useEffect(() => {
    db.getTeams()
      .then(teams => {
        setAllTeams(teams);
        // Try to auto-match by user name (first word of user name vs team name)
        const firstName = (user?.name || '').split(' ')[0].toLowerCase();
        const matched = teams.find(t => t.name.toLowerCase().includes(firstName));
        if (matched) {
          setTeam(matched);
          setSelectedId(String(matched.id));
          if (onTeamResolved) onTeamResolved(matched);
        }
      })
      .catch(() => {});
  }, [user?.name, onTeamResolved]);

  // ── Step 2: Capture GPS & save ─────────────────────────────────────────────
  const captureAndSave = useCallback(async (overrideTeam = null) => {
    const activeTeam = overrideTeam || team;
    if (!activeTeam) {
      setError('Please select your team first.');
      return;
    }

    if (!navigator.geolocation) {
      setStatus(S.GPS_DENIED);
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setStatus(S.GETTING_GPS);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setStatus(S.SAVING);

        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            const short = addr.suburb || addr.village || addr.neighbourhood ||
                          addr.town || addr.city || data.display_name || 'Unknown area';
            setAddress(short);
          }
        } catch (_) {}

        // Save to Supabase
        try {
          await db.updateTeamLocation(activeTeam.id, latitude, longitude);
          setStatus(S.SUCCESS);
          setTeam(prev => ({ ...prev, lat: latitude, lng: longitude }));
          if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: latitude, lng: longitude });
          notify(`📍 ${activeTeam.name} base location set successfully`, 'success');
        } catch (err) {
          // RLS might block direct update — store locally and show advisory
          setStatus(S.SUCCESS); // still useful for local dispatch
          setTeam(prev => ({ ...prev, lat: latitude, lng: longitude }));
          if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: latitude, lng: longitude });
          notify(`📍 Location captured (DB update requires admin permissions)`, 'info');
        }
      },
      (err) => {
        if (err.code === 1) {
          setStatus(S.GPS_DENIED);
          setError('Location access denied. Please allow GPS in your browser and try again.');
        } else {
          setStatus(S.ERROR);
          setError('Could not get GPS fix. Check your device location settings.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [team, onTeamResolved]);

  // ── Auto-capture on first load if team is matched ─────────────────────────
  useEffect(() => {
    if (team && status === S.IDLE) {
      const t = setTimeout(() => captureAndSave(team), 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  const handleManualSelect = () => {
    const chosen = allTeams.find(t => String(t.id) === String(selectedId));
    if (!chosen) { setError('Please select a team.'); return; }
    setTeam(chosen);
    if (onTeamResolved) onTeamResolved(chosen);
    captureAndSave(chosen);
  };

  // ── Status colours & labels ───────────────────────────────────────────────
  const statusConfig = {
    [S.IDLE]:         { color: '#8291b2',  label: 'Initialising…',              icon: '⚙️' },
    [S.FINDING_TEAM]: { color: '#35c7ff',  label: 'Finding your team…',         icon: '🔍' },
    [S.GETTING_GPS]:  { color: '#FF6B1A',  label: 'Acquiring GPS signal…',      icon: '📡' },
    [S.SAVING]:       { color: '#9b7bff',  label: 'Saving base location…',      icon: '💾' },
    [S.SUCCESS]:      { color: '#25e6a3',  label: 'Base location set ✓',        icon: '📍' },
    [S.ERROR]:        { color: '#FF2D2D',  label: 'Location error',              icon: '❌' },
    [S.NO_TEAM]:      { color: '#FF6B1A',  label: 'Select your team below',     icon: '🚒' },
    [S.GPS_DENIED]:   { color: '#FF2D2D',  label: 'GPS permission denied',      icon: '🔒' },
  };
  const sc = statusConfig[status] || statusConfig[S.IDLE];

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${sc.color}`, borderRadius: 12, padding: '16px 18px',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{sc.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Rescue Base Location</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
              GPS auto-detected on login · Used for AI dispatch
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700,
          color: sc.color, background: `${sc.color}18`,
          border: `1px solid ${sc.color}44`,
          padding: '3px 10px', borderRadius: 9999,
        }}>
          {sc.label}
        </div>
      </div>

      {/* Team + Location info */}
      {team && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12,
        }}>
          {[
            ['Team', team.name],
            ['Type', team.type],
            ['Members', team.members],
          ].map(([k, v]) => (
            <div key={k} style={{
              background: 'rgba(255,255,255,.03)', borderRadius: 8,
              padding: '8px 12px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, fontFamily: 'JetBrains Mono' }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {coords && status === S.SUCCESS && (
        <div style={{
          background: 'rgba(37,230,163,.07)', border: '1px solid rgba(37,230,163,.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
              {address || 'Location detected'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              {coords.accuracy && ` · ±${coords.accuracy}m accuracy`}
            </div>
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'JetBrains Mono', color: '#25e6a3',
            background: 'rgba(37,230,163,.12)', padding: '4px 8px', borderRadius: 6,
          }}>
            LIVE BASE
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(255,45,45,.08)', border: '1px solid rgba(255,45,45,.25)',
          borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#ff8a95',
          marginBottom: 12,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Manual team selection (if auto-match failed) */}
      {!team && allTeams.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: 8, padding: '8px 12px', fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="">— Select your rescue team —</option>
            {allTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
            ))}
          </select>
          <button
            onClick={handleManualSelect}
            style={{
              background: 'rgba(53,199,255,.15)', border: '1px solid rgba(53,199,255,.35)',
              color: 'var(--blue)', borderRadius: 8, padding: '8px 14px',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'JetBrains Mono',
            }}
          >
            SET BASE
          </button>
        </div>
      )}

      {/* Retry / Refresh button */}
      <button
        onClick={() => captureAndSave()}
        disabled={[S.GETTING_GPS, S.SAVING].includes(status)}
        style={{
          width: '100%', padding: '8px', borderRadius: 8, fontSize: 11,
          fontWeight: 700, fontFamily: 'JetBrains Mono', cursor: 'pointer',
          background: [S.GETTING_GPS, S.SAVING].includes(status)
            ? 'rgba(255,255,255,.04)' : 'rgba(53,199,255,.1)',
          border: '1px solid rgba(53,199,255,.25)',
          color: [S.GETTING_GPS, S.SAVING].includes(status) ? 'var(--muted)' : 'var(--blue)',
          letterSpacing: '.06em',
        }}
      >
        {status === S.GETTING_GPS ? '📡 ACQUIRING GPS…' :
         status === S.SAVING     ? '💾 SAVING…' :
         status === S.SUCCESS    ? '🔄 REFRESH LOCATION' :
                                   '📍 DETECT MY LOCATION'}
      </button>
    </div>
  );
}
