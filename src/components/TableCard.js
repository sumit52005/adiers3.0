import React from 'react';

export default function TableCard({ title, children, action }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
         className="rounded-xl overflow-hidden mb-5">
      {title && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-semibold text-sm">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

export function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
        style={{ background: 'var(--surface2)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-sm border-b border-white/5 ${className}`}>
      {children}
    </td>
  );
}
