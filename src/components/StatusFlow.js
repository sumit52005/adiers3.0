import React from 'react';

const STEPS = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved'];

export default function StatusFlow({ status }) {
  const cur = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <span className={`status-flow-step ${i < cur ? 'done' : i === cur ? 'current' : ''}`}>
            {step}
          </span>
          {i < STEPS.length - 1 && (
            <span className="text-slate-600 text-xs">›</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
