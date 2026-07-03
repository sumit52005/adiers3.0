// ─── AI Classification Engine ───────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  'Flood':              ['flood','water','submerged','drowning','river overflow','waterlogging','stranded'],
  'Fire':               ['fire','burning','smoke','flames','blast','explosion'],
  'Road Accident':      ['accident','collision','crash','vehicle','expressway','hit'],
  'Medical Emergency':  ['heart attack','unconscious','seizure','breathing','medical','hospital','fainted'],
  'Building Collapse':  ['collapsed','collapse','structure fell','rubble','trapped under','storey','debris'],
};

const PRIORITY_KEYWORDS = {
  'P1': ['trapped','critical','life threatening','many people','mass casualty','dying','collapsed','rising fast','30 people','stranded','unconscious','multiple'],
  'P2': ['injured','urgent','spreading','blocked','severe','fire spreading'],
  'P3': ['moderate','contained','minor injury','some damage'],
  'P4': ['minor','small','no injury','property damage only'],
};

export function classifyIncident(text) {
  const t = (text || '').toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => t.includes(kw))) return cat;
  }
  return 'Unknown';
}

export function assignPriority(text) {
  const t = (text || '').toLowerCase();
  for (const [p, kws] of Object.entries(PRIORITY_KEYWORDS)) {
    if (kws.some(kw => t.includes(kw))) return p;
  }
  return 'P3';
}

// ─── Haversine Distance (km) ────────────────────────────────────────────────

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─── Accurate ETA calculation ────────────────────────────────────────────────
// Uses distance-based speed model:
//   < 3 km  → urban congestion  : 20 km/h (heavy traffic, narrow roads)
//   3–8 km  → city driving      : 35 km/h
//   > 8 km  → arterial/highway  : 55 km/h
// Plus 2-min dispatch prep time

export function calculateETA(distKm) {
  let speedKmh;
  if (distKm < 3) speedKmh = 20;
  else if (distKm < 8) speedKmh = 35;
  else speedKmh = 55;
  const travelMin = (distKm / speedKmh) * 60;
  return Math.max(2, Math.round(travelMin + 2)); // +2 min prep time
}

// ─── Team type preference map ─────────────────────────────────────────────────

const TYPE_MAP = {
  'Flood':             'Flood',
  'Fire':              'Fire',
  'Medical Emergency': 'Medical',
  'Road Accident':     'Medical',
  'Building Collapse': 'Multi',
  'Unknown':           'Multi',
};

// ─── Full team ranking with distance + ETA ───────────────────────────────────
// Returns all teams ranked by composite score.
// Each entry: { team, distKm, eta, score, typeMatch }

export function rankTeams(category, lat, lng, teams) {
  if (!teams || teams.length === 0) return [];
  const needed = TYPE_MAP[category] || 'Multi';

  return teams
    .filter(t => t.lat && t.lng) // only teams with known location
    .map(team => {
      const distKm    = haversine(lat, lng, team.lat, team.lng);
      const eta       = calculateETA(distKm);
      const typeMatch = team.type === needed;
      const available = team.status === 'Available';

      // Composite score — lower is better
      // +0 for exact type match, +6 min penalty for wrong type
      // +0 if available, +15 min penalty if busy/on-route (might become free)
      const typePenalty  = typeMatch ? 0 : 6;
      const statusPenalty = available ? 0 : 15;
      const score = eta + typePenalty + statusPenalty;

      return { team, distKm: Math.round(distKm * 10) / 10, eta, score, typeMatch, available };
    })
    .sort((a, b) => a.score - b.score);
}

// ─── Smart Dispatch — picks the best team ────────────────────────────────────

export function dispatchTeam(category, lat, lng, teams) {
  const needed = TYPE_MAP[category] || 'Multi';

  // Prefer available teams matching the type, then any available, then any
  let pool = teams.filter(t => t.lat && t.lng && t.status === 'Available' && t.type === needed);
  if (!pool.length) pool = teams.filter(t => t.lat && t.lng && t.status === 'Available');
  if (!pool.length) pool = teams.filter(t => t.lat && t.lng); // fallback: any team
  if (!pool.length) return { team: null, eta: 0, distKm: 0 };

  // Pick nearest by haversine
  const ranked = pool.map(team => {
    const distKm = haversine(lat, lng, team.lat, team.lng);
    const eta    = calculateETA(distKm);
    return { team, distKm, eta };
  }).sort((a, b) => a.distKm - b.distKm);

  const best = ranked[0];
  return { team: best.team, eta: best.eta, distKm: Math.round(best.distKm * 10) / 10 };
}

// ─── Color helpers ───────────────────────────────────────────────────────────

export const PRIORITY_COLORS = {
  P1: '#EF4444',
  P2: '#F97316',
  P3: '#EAB308',
  P4: '#22C55E',
};

export const CATEGORY_COLORS = {
  'Flood':             '#3B82F6',
  'Fire':              '#EF4444',
  'Road Accident':     '#F97316',
  'Medical Emergency': '#22C55E',
  'Building Collapse': '#A855F7',
  'Unknown':           '#94A3B8',
};

export function markerColor(incident) {
  if (incident.status === 'Resolved') return '#22C55E';
  return PRIORITY_COLORS[incident.priority] || '#94A3B8';
}
