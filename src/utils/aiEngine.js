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

// ─── Smart Dispatch ──────────────────────────────────────────────────────────

const TYPE_MAP = {
  'Flood':             'Flood',
  'Fire':              'Fire',
  'Medical Emergency': 'Medical',
  'Road Accident':     'Medical',
  'Building Collapse': 'Multi',
  'Unknown':           'Multi',
};

export function dispatchTeam(category, lat, lng, teams) {
  const needed  = TYPE_MAP[category] || 'Multi';
  let pool      = teams.filter(t => t.status === 'Available' && t.type === needed);
  if (!pool.length) pool = teams.filter(t => t.status === 'Available');
  if (!pool.length) return { team: null, eta: 0 };

  const nearest = pool.reduce((a, b) =>
    haversine(lat, lng, a.lat, a.lng) < haversine(lat, lng, b.lat, b.lng) ? a : b
  );
  const dist   = haversine(lat, lng, nearest.lat, nearest.lng);
  const eta    = Math.max(3, Math.round(dist * 5));
  return { team: nearest, eta };
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
