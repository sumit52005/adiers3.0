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
import { db } from '../utils/db';
import { notify } from './Notification';
import GPSPickerMap from './maps/GPSPickerMap';
import { getAccurateCoords, reverseGeocode, clearGPSCache } from '../utils/gps';


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

    setStatus(S.GETTING_GPS);
    setError('');

    const coords = await getAccurateCoords();
    if (coords.method === 'default') {
      notify('Could not retrieve GPS. Defaulted to Pune. Please drag the pin to your exact base location.', 'warning');
    }

    setCoords({ lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy });
    setStatus(S.SAVING);

    const res = await reverseGeocode(coords.lat, coords.lng);
    setAddress(res.address);

    // Save to Supabase
    try {
      await db.updateTeamLocation(activeTeam.id, coords.lat, coords.lng);
      setStatus(S.SUCCESS);
      setTeam(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }));
      if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: coords.lat, lng: coords.lng });
      notify(`📍 ${activeTeam.name} base location set successfully`, 'success');
    } catch (err) {
      // RLS might block direct update — store locally and show advisory
      setStatus(S.SUCCESS); // still useful for local dispatch
      setTeam(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }));
      if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: coords.lat, lng: coords.lng });
      notify(`📍 Location captured (DB update requires admin permissions)`, 'info');
    }

    // Persist to localStorage so page refresh doesn't re-ask
    try {
      localStorage.setItem('aedirs_team_gps', JSON.stringify({
        teamId: activeTeam.id,
        lat: coords.lat,
        lng: coords.lng,
        address: res.address,
        savedAt: Date.now(),
      }));
    } catch (_) {}
  }, [team, onTeamResolved]);

  // ── Auto-capture on first load if team is matched ─────────────────────────
  useEffect(() => {
    if (!team || status !== S.IDLE) return;

    // Try restoring from localStorage first (avoids re-asking on refresh)
    try {
      const cached = localStorage.getItem('aedirs_team_gps');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only restore if the cached entry matches this team and is < 24 hours old
        const age = Date.now() - (parsed.savedAt || 0);
        if (parsed.teamId === team.id && age < 24 * 60 * 60 * 1000) {
          setCoords({ lat: parsed.lat, lng: parsed.lng, accuracy: null });
          setAddress(parsed.address || '');
          setStatus(S.SUCCESS);
          setTeam(prev => ({ ...prev, lat: parsed.lat, lng: parsed.lng }));
          if (onTeamResolved) onTeamResolved({ ...team, lat: parsed.lat, lng: parsed.lng });
          return; // skip GPS capture entirely
        }
      }
    } catch (_) {}

    // No valid cache — run full GPS capture
    const t = setTimeout(() => captureAndSave(team), 800);
    return () => clearTimeout(t);
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
        <>
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
          <div style={{ marginBottom: 12 }}>
            <GPSPickerMap
              lat={coords.lat}
              lng={coords.lng}
              onChange={async (newLat, newLng, newAddr) => {
                setCoords({ lat: newLat, lng: newLng, accuracy: 5 });
                setAddress(newAddr);
                const activeTeam = team;
                if (activeTeam) {
                  try {
                    await db.updateTeamLocation(activeTeam.id, newLat, newLng);
                    if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: newLat, lng: newLng });
                  } catch (_) {
                    if (onTeamResolved) onTeamResolved({ ...activeTeam, lat: newLat, lng: newLng });
                  }
                  // Update cached coordinates in localStorage
                  try {
                    localStorage.setItem('aedirs_team_gps', JSON.stringify({
                      teamId: activeTeam.id,
                      lat: newLat,
                      lng: newLng,
                      address: newAddr,
                      savedAt: Date.now(),
                    }));
                  } catch (_) {}
                }
              }}
            />
          </div>
        </>
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

      {/* Retry / Refresh + Clear buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => captureAndSave()}
          disabled={[S.GETTING_GPS, S.SAVING].includes(status)}
          style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 11,
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
        {status === S.SUCCESS && (
          <button
            onClick={() => {
              try { localStorage.removeItem('aedirs_team_gps'); } catch (_) {}
              clearGPSCache(); // also bust the module-level 5-min GPS cache
              setStatus(S.IDLE);
              setCoords(null);
              setAddress('');
              captureAndSave(team);
            }}
            style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 11,
              fontWeight: 700, fontFamily: 'JetBrains Mono', cursor: 'pointer',
              background: 'rgba(255,45,45,.1)', border: '1px solid rgba(255,45,45,.25)',
              color: '#ff8a95', letterSpacing: '.06em', whiteSpace: 'nowrap',
            }}
          >
            🗑️ RESET
          </button>
        )}
      </div>
    </div>
  );
}
