import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../components/Notification';
import { Zap, Eye, EyeOff, Shield, Users, Building2 } from 'lucide-react';
import Stepper, { Step } from '../../components/Stepper/Stepper';

// ── helpers ──────────────────────────────────────────────────────────────────
const redirectFor = role => role === 'rescue_team' ? '/rescue' : `/${role}`;

const ROLE_OPTIONS = [
  { key: 'citizen',     icon: Users,     label: 'Citizen',     desc: 'Report emergencies & track rescue' },
  { key: 'rescue_team', icon: Shield,    label: 'Rescue Team', desc: 'Manage missions & respond to incidents' },
  { key: 'authority',   icon: Building2, label: 'Authority',   desc: 'Full oversight, dispatch & analytics' },
];

const INPUT_STYLE = {
  background: 'rgba(23,33,58,.7)', border: '1px solid rgba(129,160,218,.2)',
  color: 'var(--text)', borderRadius: 10, padding: '11px 14px',
  width: '100%', fontSize: 13, outline: 'none',
};

function Field({ label, type = 'text', value, onChange, placeholder, suffix }) {
  return (
    <div className="mb-4">
      <label className="eyebrow block mb-2">{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value} onChange={onChange}
          placeholder={placeholder} style={INPUT_STYLE} />
        {suffix && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>}
      </div>
    </div>
  );
}

// ── Sign-In (single clean form) ───────────────────────────────────────────────
function SignInForm({ onSwitch }) {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [role, setRole]         = useState('citizen');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async e => {
    e?.preventDefault();
    setError('');
    if (!role) { setError('Please select a role to sign in.'); return; }
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.user.role !== role) {
        await logout();
        setError(`Access denied. Your account is not registered as a ${ROLE_OPTIONS.find(r => r.key === role)?.label || role}.`);
        return;
      }
      notify(`Welcome back, ${result.user.name}! 👋`, 'success');
      navigate(redirectFor(result.user.role));
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: '0 2rem 1.75rem' }}>
      <h2 style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sign in</h2>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20 }}>Enter your credentials to access your dashboard</p>

      <label className="eyebrow block mb-2">Login as</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        {ROLE_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = role === opt.key;
          return (
            <button key={opt.key} onClick={() => setRole(opt.key)} type="button"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                background: active ? 'rgba(82,39,255,.15)' : 'rgba(23,33,58,.5)',
                border: `1px solid ${active ? 'rgba(82,39,255,.5)' : 'rgba(129,160,218,.15)'}`,
                color: 'var(--text)', transition: 'all .2s',
                boxShadow: active ? '0 0 10px rgba(82,39,255,.2)' : 'none',
                cursor: 'pointer',
              }}>
              <Icon size={16} style={{ color: active ? '#a78bff' : 'var(--muted)' }} />
              <span style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      <Field label="Password" type={showPw ? 'text' : 'password'} value={password}
        onChange={e => setPassword(e.target.value)} placeholder="••••••••"
        suffix={<button type="button" onClick={() => setShowPw(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 0 }}>
          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>} />

      {error && (
        <div style={{ background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.3)', color: '#ff8a95', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        style={{ width: '100%', background: 'linear-gradient(135deg,#5227FF,#7c4fff)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, fontSize: 14, boxShadow: '0 6px 18px rgba(82,39,255,.35)' }}>
        {loading ? '⏳ Signing in…' : 'Sign In →'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
        Don't have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#79a8ff', fontSize: 12, padding: 0, textDecoration: 'underline' }}>Create one</button>
      </div>
    </div>
  );
}

// ── Sign-Up Steps ─────────────────────────────────────────────────────────────
function SignUpStepper({ onSwitch }) {
  const { register } = useAuth();
  const [role, setRole]         = useState('');
  const [form, setForm]         = useState({ name: '', email: '', password: '', phone: '', location: '' });
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleComplete = async () => {
    setError('');
    if (!role || !form.name || !form.email || !form.password) {
      setError('Please complete all required fields.'); return;
    }
    setLoading(true);
    try {
      const result = await register({ name: form.name, email: form.email, password: form.password, phone: form.phone, role });
      if (result.needsConfirmation) {
        setSuccessMessage('Registration successful! Please check your email inbox to confirm your account before logging in.');
        notify('Verification email sent! ✉️', 'success');
      } else {
        notify('Account created successfully! Please sign in with your credentials. 🎉', 'success');
        onSwitch();
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  if (successMessage) {
    return (
      <div style={{ padding: '1.5rem 2rem 2rem', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: 'rgba(34,197,94,.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(34,197,94,.3)' }}>
          <span style={{ fontSize: 24 }}>✉️</span>
        </div>
        <h2 style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#4ade80' }}>Verify your email</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          {successMessage}
        </p>
        <button onClick={onSwitch}
          style={{ width: '100%', background: 'linear-gradient(135deg,#5227FF,#7c4fff)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, fontSize: 14, boxShadow: '0 6px 18px rgba(82,39,255,.35)' }}>
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      <Stepper initialStep={1} onFinalStepCompleted={handleComplete}
        backButtonText="Back" nextButtonText="Continue"
        stepCircleContainerClassName=""
        nextButtonProps={{ disabled: loading }}>

        {/* Step 1 — Account Type */}
        <Step>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Choose your role</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>Select the account type that best describes you</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {ROLE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = role === opt.key;
              return (
                <button key={opt.key} onClick={() => setRole(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                    background: active ? 'rgba(82,39,255,.15)' : 'rgba(23,33,58,.5)',
                    border: `1px solid ${active ? 'rgba(82,39,255,.5)' : 'rgba(129,160,218,.15)'}`,
                    color: 'var(--text)', transition: 'all .2s',
                    boxShadow: active ? '0 0 14px rgba(82,39,255,.2)' : 'none',
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(82,39,255,.25)' : 'rgba(129,160,218,.08)', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: active ? '#a78bff' : 'var(--muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{opt.desc}</div>
                  </div>
                  {active && <div style={{ marginLeft: 'auto', color: '#a78bff', fontSize: 18 }}>✓</div>}
                </button>
              );
            })}
          </div>
          {!role && <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>Select a role to continue</p>}
        </Step>

        {/* Step 2 — Basic Details */}
        <Step>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Your details</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>Create your AEDIRS account</p>
          <Field label="Full Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
          <Field label="Email Address" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
          <Field label="Password" type={showPw ? 'text' : 'password'} value={form.password}
            onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters"
            suffix={<button type="button" onClick={() => setShowPw(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 0 }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>} />
        </Step>

        {/* Step 3 — Role-specific info */}
        <Step>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            {role === 'citizen' ? 'Your location' : role === 'rescue_team' ? 'Team details' : 'Organisation info'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>Help us tailor your experience</p>
          <Field label="Phone Number" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
          {role === 'citizen' && <Field label="Your City / Area" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Pune, Maharashtra" />}
          {role === 'rescue_team' && <Field label="Team / Station ID" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. PUNE-FIRE-A1" />}
          {role === 'authority' && <Field label="Department / Office" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. NDMA Pune District" />}
        </Step>

        {/* Step 4 — Confirm */}
        <Step>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Confirm & create</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>Review your information before submitting</p>
          <div style={{ background: 'rgba(82,39,255,.08)', border: '1px solid rgba(82,39,255,.2)', borderRadius: 10, padding: '14px', marginBottom: 12 }}>
            {[
              ['Role', ROLE_OPTIONS.find(r => r.key === role)?.label || '—'],
              ['Name', form.name || '—'],
              ['Email', form.email || '—'],
              ['Phone', form.phone || '—'],
              ['Location / ID', form.location || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(129,160,218,.1)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          {error && (
            <div style={{ background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.3)', color: '#ff8a95', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>
              ❌ {error}
            </div>
          )}
          {loading && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>⏳ Creating your account…</p>}
        </Step>
      </Stepper>

      <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
        Already have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#79a8ff', fontSize: 12, padding: 0, textDecoration: 'underline' }}>Sign in</button>
      </div>
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  return (
    <div className="hero-bg min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="hero-grid" />
      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(82,39,255,.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: '1px solid rgba(82,39,255,.35)' }}>
            <Zap size={22} style={{ color: '#a78bff' }} />
          </div>
          <h1 style={{ fontFamily: 'Rajdhani', fontSize: 26, fontWeight: 700, letterSpacing: '.03em' }}>
            {mode === 'login' ? 'Sign in to AEDIRS' : 'Join AEDIRS'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            AI-Enabled Disaster Incident Response System
          </p>
        </div>

        <div style={{ background: 'linear-gradient(145deg,rgba(16,25,46,.96),rgba(10,16,32,.92))', border: '1px solid rgba(82,39,255,.2)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
          {/* Top accent */}
          <div style={{ height: 2, background: 'linear-gradient(90deg,#5227FF,#9b7bff,transparent)' }} />

          {/* Mode toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '16px 20px 0', background: 'rgba(23,33,58,.4)' }}>
            {[['login','Sign In'], ['signup','Sign Up']].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600, transition: 'all .2s', border: 'none',
                  background: mode === m ? 'rgba(82,39,255,.25)' : 'transparent',
                  color: mode === m ? '#c4b5fd' : 'var(--muted)',
                  borderBottom: mode === m ? '2px solid #5227FF' : '2px solid transparent',
                }}>
                {l}
              </button>
            ))}
          </div>

          {mode === 'login'
            ? <SignInForm onSwitch={() => setMode('signup')} />
            : <SignUpStepper onSwitch={() => setMode('login')} />
          }
        </div>
      </div>
    </div>
  );
}
