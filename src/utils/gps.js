/**
 * gps.js — High-reliability GPS utility (deployment-ready).
 *
 * Strategy:
 * 1. Returns cached result if < 5 minutes old — prevents race conditions and
 *    stops multiple components from fighting over coordinates.
 * 2. HTTPS context guard — geolocation is blocked on HTTP deployments;
 *    falls through to IP fallback automatically.
 * 3. Browser GPS with high-accuracy + 10s timeout.
 * 4. IP-based fallback (ipapi.co) if GPS is blocked/denied.
 * 5. City-centre default as absolute last resort.
 *
 * Key exports:
 *   getAccurateCoords()   — main entry point used everywhere
 *   clearGPSCache()       — call this when user presses "Refresh Location"
 *   reverseGeocode()      — lat/lng → address string
 *   forwardGeocode()      — address string → lat/lng
 */

// Default centre (Pune, India)
export const DEFAULT_COORDS = { lat: 18.5204, lng: 73.8567 };

// ── Module-level GPS cache ────────────────────────────────────────────────────
// Shared across every component that calls getAccurateCoords().
// A fresh GPS fix is cached for 5 minutes so that switching tabs, re-renders,
// and multiple simultaneous callers all receive the SAME result instantly.
let _gpsCache    = null;
let _gpsCacheAt  = 0;
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

/** Call this when the user explicitly presses "Refresh / Re-detect Location" */
export function clearGPSCache() {
  _gpsCache   = null;
  _gpsCacheAt = 0;
}

// ── IP-based fallback (used when GPS unavailable / HTTP context) ──────────────
async function _tryIPFallback() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lng: data.longitude,
          accuracy: 5000,
          method: 'ip',
        };
      }
    }
  } catch (_) {}
  return { ...DEFAULT_COORDS, accuracy: null, method: 'default' };
}

/**
 * Gets the most accurate location possible.
 * Returns the cached result if called within CACHE_TTL of the last fix.
 */
export async function getAccurateCoords() {
  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (_gpsCache && (Date.now() - _gpsCacheAt) < CACHE_TTL) {
    return _gpsCache;
  }

  return new Promise(resolve => {
    const done = (result) => {
      _gpsCache   = result;
      _gpsCacheAt = Date.now();
      resolve(result);
    };

    // ── HTTPS guard ───────────────────────────────────────────────────────────
    // Browsers require a secure context (HTTPS or localhost) for geolocation.
    // On plain HTTP deployments it silently fails — use IP fallback instead.
    if (!window.isSecureContext) {
      _tryIPFallback().then(done);
      return;
    }

    // ── No geolocation API ───────────────────────────────────────────────────
    if (!navigator.geolocation) {
      done({ ...DEFAULT_COORDS, accuracy: null, method: 'default' });
      return;
    }

    // ── Browser GPS ──────────────────────────────────────────────────────────
    navigator.geolocation.getCurrentPosition(
      pos => {
        done({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          method:   'gps',
        });
      },
      async () => {
        // GPS denied / timed-out → IP fallback
        done(await _tryIPFallback());
      },
      {
        enableHighAccuracy: true,
        timeout:            10000,  // 10 s (up from 8 s for slow mobile networks)
        maximumAge:         60000,  // accept a fix up to 1 min old from browser cache
      }
    );
  });
}

/**
 * Resolves lat/lng coordinates into a human-readable address via Nominatim.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'AEDIRS-Disaster-System' } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const shortAddress =
        addr.road          ||
        addr.suburb        ||
        addr.village       ||
        addr.neighbourhood ||
        addr.town          ||
        addr.city          ||
        data.display_name  ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      return {
        address:     shortAddress,
        fullAddress: data.display_name || shortAddress,
        raw:         data,
      };
    }
  } catch (_) {}
  return {
    address:     `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
}

/**
 * Forward-geocodes an address string to lat/lng coordinates.
 */
export async function forwardGeocode(searchQuery) {
  if (!searchQuery || searchQuery.trim().length < 3) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'AEDIRS-Disaster-System' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat:          parseFloat(data[0].lat),
          lng:          parseFloat(data[0].lon),
          display_name: data[0].display_name,
        };
      }
    }
  } catch (_) {}
  return null;
}
