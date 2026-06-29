import React, { useEffect, useState } from 'react';

const lines=['Loading incident database','Connecting rescue team network','Starting AI classification engine','Activating live heatmap'];
export default function BootScreen(){
  const [visible,setVisible]=useState(()=>sessionStorage.getItem('aedirs-booted')!=='1');
  const [shown,setShown]=useState(0);
  useEffect(()=>{ if(!visible)return; const timers=lines.map((_,i)=>setTimeout(()=>setShown(i+1),350+i*330)); const done=setTimeout(()=>{sessionStorage.setItem('aedirs-booted','1');setVisible(false)},2300); return()=>{timers.forEach(clearTimeout);clearTimeout(done)} },[visible]);
  if(!visible)return null;
  return <div className="boot-screen"><div className="boot-terminal"><div className="boot-logo mb-4"><span style={{color:'var(--critical)'}}>AE</span>DIRS <span className="text-xs" style={{color:'var(--muted)'}}>v1.0.0 — INITIALIZING...</span></div>{lines.slice(0,shown).map(x=><div key={x} className="flex justify-between gap-4"><span>▸ {x}...</span><span className="boot-ok">[OK]</span></div>)}{shown===lines.length&&<div className="boot-ready mt-4">SYSTEM READY — ALL UNITS OPERATIONAL</div>}</div></div>;
}
