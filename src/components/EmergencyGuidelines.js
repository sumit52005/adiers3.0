import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Stepper, { Step } from './Stepper/Stepper';

const DISASTERS = [
  {
    id: 'flood', icon: '🌊', title: 'Flood', color: '#35c7ff', urgency: 'high',
    steps: [
      { action: 'Move Immediately', detail: 'Go to the highest floor or rooftop. Do NOT wait — water rises faster than you think.' },
      { action: 'Power Off', detail: 'Turn off the main electrical switch before water enters your building.' },
      { action: 'Don\'t Walk in Water', detail: 'Just 15 cm of fast-moving water can knock you off your feet.' },
      { action: 'Call 112', detail: 'If trapped, call 112 and wave a bright cloth from your window to signal rescuers.' },
    ],
    donts: ['Drive through floodwater', 'Touch electrical equipment', 'Drink floodwater', 'Return home until authorities clear it'],
    quiz: [
      { q: 'You\'re at home. Water is rising rapidly. What do you do first?', opts: ['Stay on ground floor', 'Go to the highest floor', 'Open windows', 'Pack belongings'], ans: 1 },
      { q: 'How deep of moving water can knock an adult off their feet?', opts: ['1 meter', '60 cm', '15 cm', 'Only waist-deep'], ans: 2 },
    ],
  },
  {
    id: 'fire', icon: '🔥', title: 'Fire', color: '#ff4d5e', urgency: 'critical',
    steps: [
      { action: 'Raise the Alarm', detail: 'Shout "FIRE!" and activate the nearest fire alarm. Call 101 immediately.' },
      { action: 'Don\'t Use Elevators', detail: 'Always use stairs. Elevators may stop, trapping you in a smoke-filled shaft.' },
      { action: 'Crawl Low', detail: 'Smoke and heat rise. Crawl on your hands and knees to stay in cooler, cleaner air.' },
      { action: 'Stop Drop Roll', detail: 'If your clothes catch fire: STOP. DROP to the ground. ROLL to smother flames.' },
    ],
    donts: ['Use elevators', 'Open doors without checking heat', 'Re-enter the building', 'Collect belongings'],
    quiz: [
      { q: 'You smell smoke. What do you do first?', opts: ['Collect valuables', 'Call friends', 'Raise alarm & call 101', 'Open windows'], ans: 2 },
      { q: 'Why should you crawl low in a smoky room?', opts: ['Faster movement', 'Cleaner air is near the floor', 'Easier to find exits', 'None of these'], ans: 1 },
    ],
  },
  {
    id: 'earthquake', icon: '🏢', title: 'Earthquake', color: '#ffd166', urgency: 'high',
    steps: [
      { action: 'DROP', detail: 'Drop immediately onto your hands and knees. This prevents being knocked down.' },
      { action: 'COVER', detail: 'Cover your head and neck with your arms. Get under a sturdy table if nearby.' },
      { action: 'HOLD ON', detail: 'Hold on to your shelter and be prepared to move with it until shaking stops.' },
      { action: 'WAIT', detail: 'Do not run outside during shaking — most injuries happen when people try to move.' },
    ],
    donts: ['Stand in doorframes', 'Run outside while shaking', 'Use elevators after', 'Ignore aftershocks'],
    quiz: [
      { q: 'The "Drop Cover Hold" order — what comes second?', opts: ['Hold On', 'Drop', 'Cover', 'Run'], ans: 2 },
      { q: 'When is it safe to go outside during an earthquake?', opts: ['Immediately', 'After 30 seconds', 'Only when shaking completely stops', 'Never'], ans: 2 },
    ],
  },
  {
    id: 'accident', icon: '🚗', title: 'Road Accident', color: '#25e6a3', urgency: 'medium',
    steps: [
      { action: 'Secure the Scene', detail: 'Turn on hazard lights. Place warning triangles 50 m behind the vehicle.' },
      { action: 'Call for Help', detail: 'Call 108 for ambulance and 100 for police. State location clearly.' },
      { action: 'Don\'t Move Victims', detail: 'Moving injured people can worsen spinal injuries. Only move if there is fire risk.' },
      { action: 'Basic First Aid', detail: 'Apply pressure to wounds with a clean cloth. Keep victims warm and calm.' },
    ],
    donts: ['Block the emergency lane', 'Move injured persons without cause', 'Leave the scene', 'Crowd around victims'],
    quiz: [
      { q: 'You witness a road accident. First call?', opts: ['Your family', '108 Ambulance', 'Insurance company', 'A tow truck'], ans: 1 },
      { q: 'Should you move an injured accident victim?', opts: ['Yes, immediately', 'Only if there is fire risk', 'Always move to footpath', 'Call first then move'], ans: 1 },
    ],
  },
];

const URGENCY_COLORS = { critical: '#ff4d5e', high: '#FF6B1A', medium: '#ffd166' };

// ── Scenario Card ────────────────────────────────────────────────────────────
function ScenarioCard({ d, onClick, isActive }) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      style={{
        background: isActive ? `${d.color}18` : 'rgba(16,25,46,.7)',
        border: `1px solid ${isActive ? d.color + '55' : 'rgba(129,160,218,.15)'}`,
        borderTop: `3px solid ${d.color}`,
        borderRadius: 12,
        padding: '16px',
        textAlign: 'left',
        color: 'var(--text)',
        width: '100%',
        boxShadow: isActive ? `0 0 20px ${d.color}22` : 'none',
        transition: 'box-shadow .2s',
        cursor: 'pointer',
      }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{d.icon}</div>
      <div style={{ fontFamily: 'Rajdhani', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{d.title}</div>
      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', padding: '2px 7px', borderRadius: 4, display: 'inline-block',
        background: `${URGENCY_COLORS[d.urgency]}20`, color: URGENCY_COLORS[d.urgency], fontWeight: 700, letterSpacing: '.06em' }}>
        {d.urgency.toUpperCase()}
      </div>
    </motion.button>
  );
}

// ── Step-by-step walkthrough ─────────────────────────────────────────────────
function WalkthroughStepper({ d, onDone }) {
  const [quizMode, setQuizMode]   = useState(false);
  const [qIdx, setQIdx]           = useState(0);
  const [chosen, setChosen]       = useState(null);
  const [score, setScore]         = useState(0);
  const [quizDone, setQuizDone]   = useState(false);

  const handleQuizAnswer = idx => {
    setChosen(idx);
    if (idx === d.quiz[qIdx].ans) setScore(s => s + 1);
    setTimeout(() => {
      if (qIdx + 1 < d.quiz.length) { setQIdx(i => i + 1); setChosen(null); }
      else setQuizDone(true);
    }, 800);
  };

  if (quizDone) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{score === d.quiz.length ? '🏆' : '📚'}</div>
        <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {score}/{d.quiz.length} Correct
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
          {score === d.quiz.length ? 'Perfect! You know what to do. 🎉' : 'Good effort. Review the steps again to be ready.'}
        </div>
        <button onClick={onDone} style={{ background: d.color, color: '#000', border: 'none', borderRadius: 9999, padding: '10px 24px', fontWeight: 700, fontSize: 13 }}>
          Back to Guidelines
        </button>
      </motion.div>
    );
  }

  if (quizMode) {
    const q = d.quiz[qIdx];
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)', letterSpacing: '.1em', marginBottom: 12 }}>
          QUESTION {qIdx + 1} OF {d.quiz.length}
        </div>
        <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, marginBottom: 16, lineHeight: 1.3 }}>{q.q}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.opts.map((opt, i) => {
            const isCorrect  = chosen !== null && i === q.ans;
            const isWrong    = chosen === i && i !== q.ans;
            return (
              <button key={i} onClick={() => chosen === null && handleQuizAnswer(i)}
                style={{
                  padding: '12px 14px', borderRadius: 8, textAlign: 'left', fontSize: 13,
                  background: isCorrect ? 'rgba(0,230,118,.15)' : isWrong ? 'rgba(255,77,94,.15)' : 'rgba(23,33,58,.6)',
                  border: `1px solid ${isCorrect ? 'rgba(0,230,118,.4)' : isWrong ? 'rgba(255,77,94,.4)' : 'rgba(129,160,218,.15)'}`,
                  color: isCorrect ? 'var(--safe)' : isWrong ? 'var(--critical)' : 'var(--text)',
                  cursor: chosen === null ? 'pointer' : 'default',
                  transition: 'all .2s',
                }}>
                {isCorrect ? '✅ ' : isWrong ? '❌ ' : `${String.fromCharCode(65 + i)}. `}{opt}
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <Stepper initialStep={1} onFinalStepCompleted={() => setQuizMode(true)}
      backButtonText="Back" nextButtonText="Next step"
      stepCircleContainerClassName=""
      nextButtonProps={{ style: { background: `linear-gradient(135deg,${d.color},${d.color}cc)`, color: '#000', fontWeight: 700 } }}>
      {d.steps.map((step, i) => (
        <Step key={i}>
          <div style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${d.color}20`, border: `1px solid ${d.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontWeight: 700, color: d.color, fontSize: 14 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: d.color }}>{step.action}</div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, marginBottom: 12 }}>{step.detail}</div>
          </div>
        </Step>
      ))}
      {/* Final step — Don'ts */}
      <Step>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: '#ff4d5e', marginBottom: 12 }}>❌ What NOT to do</div>
          {d.donts.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: '#ff4d5e', flexShrink: 0 }}>✕</span>{item}
            </div>
          ))}
          <div style={{ marginTop: 14, padding: '10px 12px', background: `${d.color}12`, border: `1px solid ${d.color}30`, borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
            🎯 All steps complete! Take a quick quiz to test your knowledge →
          </div>
        </div>
      </Step>
    </Stepper>
  );
}

// ── Main EmergencyGuidelines ─────────────────────────────────────────────────
export default function EmergencyGuidelines() {
  const [active, setActive]   = useState(null);
  const [view, setView]       = useState('cards'); // 'cards' | 'walkthrough'

  const openWalkthrough = d => { setActive(d); setView('walkthrough'); };
  const back = () => { setView('cards'); setActive(null); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700 }}>🛡️ Emergency Guidelines</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Interactive walkthroughs — learn what to do before an emergency happens
          </p>
        </div>
        {view === 'walkthrough' && (
          <button onClick={back} style={{ background: 'rgba(129,160,218,.1)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            ← Back
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'cards' && (
          <motion.div key="cards" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
              {DISASTERS.map(d => (
                <ScenarioCard key={d.id} d={d} isActive={false}
                  onClick={() => openWalkthrough(d)} />
              ))}
            </div>
            {/* Quick tips */}
            <div style={{ background: 'rgba(82,39,255,.08)', border: '1px solid rgba(82,39,255,.2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#a78bff', letterSpacing: '.1em', fontWeight: 700, marginBottom: 8 }}>
                💡 ALWAYS REMEMBER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['112', 'National Emergency'], ['108', 'Ambulance'], ['101', 'Fire Brigade'], ['100', 'Police']].map(([num, label]) => (
                  <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700, color: '#a78bff' }}>{num}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'walkthrough' && active && (
          <motion.div key="walk" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', background: `${active.color}12`, border: `1px solid ${active.color}30`, borderRadius: 10 }}>
              <span style={{ fontSize: 28 }}>{active.icon}</span>
              <div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: active.color }}>{active.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Step-by-step guide · Quiz included</div>
              </div>
            </div>
            <WalkthroughStepper d={active} onDone={back} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
