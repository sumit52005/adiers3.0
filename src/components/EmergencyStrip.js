import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function EmergencyStrip() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4 text-sm"
         style={{
           background: 'linear-gradient(90deg,rgba(239,68,68,.15),rgba(239,68,68,.05))',
           border: '1px solid rgba(239,68,68,.25)'
         }}>
      <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
      <span className="text-red-300">
        <strong>Emergency? Call 112</strong>
        <span className="text-slate-400"> — or use the Report Emergency form for detailed incident submission</span>
      </span>
    </div>
  );
}
