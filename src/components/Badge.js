import React from 'react';

export function PriorityBadge({ priority }) {
  const styles = {
    P1: 'badge-p1',
    P2: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    P3: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    P4: 'bg-green-500/20 text-green-300 border border-green-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${styles[priority] || 'bg-slate-500/20 text-slate-400'}`}>
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  const resolved = status === 'Resolved';
  const dotClass = resolved ? 'dot-available' : status === 'On Route' || status === 'Assigned' ? 'dot-onroute' : 'dot-busy';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
      resolved ? 'bg-slate-500/20 text-slate-400' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`} style={{background:resolved?'var(--safe)':status==='On Route'||status==='Assigned'?'var(--high)':'var(--blue)'}} />{status}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const styles = {
    'Flood':             'bg-blue-500/15 text-blue-300',
    'Fire':              'bg-red-500/15 text-red-300',
    'Road Accident':     'bg-orange-500/15 text-orange-300',
    'Medical Emergency': 'bg-green-500/15 text-green-300',
    'Building Collapse': 'bg-purple-500/15 text-purple-300',
    'Unknown':           'bg-slate-500/15 text-slate-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[category] || styles['Unknown']}`}>
      {category}
    </span>
  );
}
