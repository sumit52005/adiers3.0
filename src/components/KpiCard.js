import React, { useEffect, useState } from 'react';

function useCountUp(target, duration = 1200) {
  const numeric = typeof target === 'number' ? target : Number.parseFloat(target);
  const valid = Number.isFinite(numeric);
  const [value, setValue] = useState(valid ? 0 : target);
  useEffect(() => {
    if (!valid) { setValue(target); return undefined; }
    let frame; const start = performance.now();
    const tick = now => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(numeric * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, numeric, valid, duration]);
  return value;
}

const trends = [[3,8,6,13,10,17,21],[16,14,18,11,15,9,12],[3,5,7,8,13,15,19],[14,10,12,8,9,6,5]];

export default function KpiCard({ label, value, color = 'var(--blue)', sub, icon, trend }) {
  const display = useCountUp(value);
  const suffix = typeof value === 'string' ? (value.match(/[^\d.]+$/)?.[0] || '') : '';
  const points = trend || trends[label.length % trends.length];
  const max = Math.max(...points); const min = Math.min(...points);
  const path = points.map((p,i) => `${i ? 'L':'M'} ${i * 100/(points.length-1)} ${24 - ((p-min)/(max-min||1))*19}`).join(' ');
  return (
    <div className="kpi-card" style={{ '--accent':color }}>
      <div className="flex items-start justify-between relative z-10">
        <span className="eyebrow">{label}</span>
        <span style={{ color, fontSize:18 }}>{icon}</span>
      </div>
      <div className="kpi-value mt-3 relative z-10" style={{ color }}>
        {display}{typeof display === 'number' ? suffix : ''}
      </div>
      <svg className="sparkline relative z-10" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${path} L 100 28 L 0 28 Z`} fill={color} opacity=".08" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="text-[10px] mt-1 mono relative z-10" style={{ color:'var(--muted)' }}>{sub || 'LIVE · UPDATED NOW'}</div>
    </div>
  );
}
