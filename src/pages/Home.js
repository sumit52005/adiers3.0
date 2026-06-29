import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, MapPinned, Radio, ShieldCheck, Truck, ArrowRight, Activity } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import Hyperspeed from '../components/Hyperspeed';

const features = [
  { icon: Radio, title: 'Citizen Signal Intake', desc: 'GPS-aware incident reporting with media evidence, structured for immediate operational use.', color: '#ff4d5e' },
  { icon: BrainCircuit, title: 'AI Threat Classification', desc: 'Language models identify incident type, severity, and P1–P4 response priority in real time.', color: '#9b7bff' },
  { icon: MapPinned, title: 'Live Tactical Map', desc: 'A unified geospatial view of active incidents, danger clusters, and field team positions.', color: '#35c7ff' },
  { icon: Truck, title: 'Precision Dispatch', desc: 'Nearest capable rescue unit assigned automatically using distance and readiness signals.', color: '#ff8a3d' },
  { icon: Activity, title: 'Authority Intelligence', desc: 'Operational analytics surface response time, capacity, trends, and unresolved threats.', color: '#25e6a3' },
  { icon: ShieldCheck, title: 'Continuous Alerts', desc: 'Every stakeholder stays synchronized as incidents move from report to resolution.', color: '#ffd166' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-enter">
      <section className="hero-bg relative overflow-hidden flex items-center px-6 py-20">
        <div className="hero-grid" />
        <Hyperspeed />
        <div className="absolute top-8 left-8 eyebrow hidden lg:block">REGION 18.5204° N / 73.8567° E</div>
        <div className="absolute bottom-8 right-8 eyebrow hidden lg:block">ENCRYPTED NETWORK · AES-256</div>

        <div className="relative max-w-6xl mx-auto w-full z-10">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md mb-8" style={{ border: '1px solid rgba(53,199,255,.32)', background: 'rgba(53,199,255,.07)' }}>
            <span className="w-2 h-2 rounded-full dot-available" style={{ background: 'var(--safe)' }} />
            <span className="eyebrow" style={{ color: 'var(--blue)' }}>NATIONAL RESPONSE GRID · ACTIVE</span>
          </div>
          <h1 className="hero-title">WHEN <span style={{ color: 'var(--critical)' }}>SECONDS</span><br />COUNT.</h1>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mt-10">
            <div>
              <p className="text-lg max-w-xl leading-relaxed" style={{ color: '#8c9aba' }}>AI-powered disaster response. Report, classify, and dispatch the right unit—before a crisis becomes a catastrophe.</p>
              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={() => navigate('/login')} className="command-button flex items-center gap-2 px-6 py-3 rounded-md font-bold">
                  <AlertTriangle size={17} /> REPORT EMERGENCY
                </button>
                <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold" style={{ border: '1px solid var(--border2)', background: 'rgba(15,22,41,.65)' }}>
                  AUTHORITY ACCESS <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex gap-8 lg:text-right">
              <div>
                <div className="eyebrow">AVG RESPONSE</div>
                <div className="text-3xl mono mt-1" style={{ color: 'var(--blue)' }}>12:08</div>
              </div>
              <div>
                <div className="eyebrow">SYSTEM UPTIME</div>
                <div className="text-3xl mono mt-1" style={{ color: 'var(--safe)' }}>99.98%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-8" style={{ background: '#070b16', borderBlock: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-4 gap-4">
          <KpiCard label="Total incidents" value={56} color="var(--critical)" sub="+8 TODAY" />
          <KpiCard label="Active threats" value={13} color="var(--high)" sub="3 REQUIRE ACTION" />
          <KpiCard label="Resolved" value={43} color="var(--safe)" sub="76.8% CLEARANCE" />
          <KpiCard label="Teams deployed" value={6} color="var(--blue)" sub="4 UNITS AVAILABLE" />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <div className="eyebrow mb-3" style={{ color: 'var(--critical)' }}>OPERATIONAL CAPABILITIES</div>
            <h2 className="text-4xl font-bold">ONE SYSTEM. EVERY SECOND.</h2>
          </div>
          <p className="max-w-md text-sm" style={{ color: 'var(--muted)' }}>A shared command layer connecting citizens, rescue teams, AI, and authorities from first signal to final resolution.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {features.map(({ icon: Icon, ...f }) => (
            <article className="feature-card glass-panel rounded-xl p-6" style={{ '--accent': f.color, borderTop: `2px solid ${f.color}` }} key={f.title}>
              <div className="hex-icon mb-5"><Icon size={20} /></div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              <div className="eyebrow mt-6" style={{ color: f.color }}>MODULE ONLINE →</div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 text-center" style={{ background: 'radial-gradient(circle at 50% 100%,rgba(255,45,45,.11),transparent 50%),#060914', borderTop: '1px solid var(--border)' }}>
        <div className="eyebrow mb-3">DO NOT WAIT FOR THE SITUATION TO ESCALATE</div>
        <h2 className="text-4xl font-bold mb-6">THE RESPONSE NETWORK IS STANDING BY.</h2>
        <button onClick={() => navigate('/login')} className="command-button px-8 py-3 rounded-md font-bold">ENTER AEDIRS COMMAND</button>
      </section>

      <footer className="px-6 py-5 flex justify-between text-[9px] mono tracking-wider" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
        <span>© 2026 AEDIRS · EMERGENCY OPERATIONS</span>
        <span>ALL CHANNELS SECURE</span>
      </footer>
    </div>
  );
}
