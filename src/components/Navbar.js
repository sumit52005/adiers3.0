import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, ChevronDown, LogOut, ShieldCheck, Zap } from 'lucide-react';

const incidents = [
  ['P1', 'FLOOD', 'Pune Station', '8 MIN AGO'], ['P2', 'FIRE', 'Hadapsar Industrial Zone', '12 MIN AGO'],
  ['P1', 'COLLAPSE', 'Shivajinagar', 'LIVE'], ['P3', 'MEDICAL', 'Kothrud Depot', '21 MIN AGO']
];

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  return <div className="mono text-right"><div className="text-[9px] tracking-[.16em]" style={{ color: 'var(--muted)' }}>IST · LIVE</div><div className="text-[13px] tracking-[.13em]" style={{ color: 'var(--safe)' }}>{time.toLocaleTimeString('en-IN', { hour12: false })}</div></div>;
}

function Ticker() { const list = [...incidents, ...incidents]; return <div className="ticker-window nav-ticker flex-1 max-w-3xl"><div className="ticker-track">{list.map((x, i) => <div className="ticker-item" key={i}><span className="live-dot" /><b style={{ color: x[0] === 'P1' ? 'var(--critical)' : 'var(--high)' }}>{x[0]}</b><span>·</span><b style={{ color: 'var(--text)' }}>{x[1]}</b><span>· {x[2]} · {x[3]}</span></div>)}</div></div> }

export default function Navbar({ notifications = [] }) {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false);
  const home = () => navigate(user ? `/${user.role === 'rescue_team' ? 'rescue' : user.role}` : '/');
  return <nav className="command-nav sticky top-0 z-50 relative flex items-center gap-5 px-6">
    <button onClick={home} className="flex items-center gap-3 shrink-0 text-left">
      <div className="w-9 h-9 grid place-items-center rounded-md" style={{ background: 'rgba(53,199,255,.1)', border: '1px solid rgba(53,199,255,.38)', boxShadow: '0 0 20px rgba(53,199,255,.14)' }}><Zap size={19} color="var(--blue)" fill="var(--blue)" /></div>
      <div><div className="text-xl font-bold leading-none tracking-[.08em]" style={{ fontFamily: 'Rajdhani' }}>AE<span style={{ color: 'var(--blue)' }}>DIRS</span></div><div className="text-[8px] tracking-[.18em] mt-1" style={{ color: 'var(--muted)' }}>EMERGENCY OPS CENTER</div></div>
    </button>
    <div className="nav-status hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ border: '1px solid var(--border)', background: 'rgba(0,230,118,.04)' }}><span className="w-1.5 h-1.5 rounded-full dot-available" style={{ background: 'var(--safe)' }} /><span className="text-[9px] mono tracking-wider" style={{ color: 'var(--safe)' }}>ALL SYSTEMS OPERATIONAL</span></div>
    <Ticker />
    <div className="ml-auto flex items-center gap-3 shrink-0"><LiveClock />
      {user ? <><button className="relative w-9 h-9 grid place-items-center rounded-md" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}><Bell size={15} color="var(--muted)" /><span className="absolute -top-1 -right-1 w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold" style={{ background: 'var(--critical)' }}>{notifications.length || 3}</span></button>
        <div className="relative"><button onClick={() => setOpen(v => !v)} className="nav-role flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}><div className="w-7 h-7 rounded grid place-items-center font-bold text-xs" style={{ background: 'rgba(41,121,255,.15)', color: '#79a8ff' }}>{user.name?.[0]}</div><div className="text-left"><div className="text-xs font-semibold max-w-28 truncate">{user.name}</div><div className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{user.role?.replace('_', ' ')}</div></div><ChevronDown size={12} /></button>
          {open && <div className="absolute right-0 top-full mt-2 w-52 glass-panel rounded-lg overflow-hidden"><div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}><div className="text-xs font-semibold">Authenticated operator</div><div className="text-[10px] mt-1 truncate" style={{ color: 'var(--muted)' }}>{user.email}</div></div><button onClick={() => { logout(); navigate('/') }} className="w-full flex gap-2 px-4 py-3 text-xs" style={{ color: '#ff6b6b' }}><LogOut size={14} />Terminate session</button></div>}</div></> :
        <><button onClick={() => navigate('/login')} className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-semibold" style={{ color: 'var(--muted)' }}><ShieldCheck size={14} />Authority Login</button><button onClick={() => navigate('/login')} className="command-button px-4 py-2 rounded-md text-xs font-bold tracking-wide">REPORT EMERGENCY</button></>}
    </div>
  </nav>;
}
