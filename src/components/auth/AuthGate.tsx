import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, RadioTower, ShieldCheck } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole } from '../../types/fieldops';
import { api, ApiError } from '../../services/apiClient';
import { AUTH_MODE, describeAuthError, onFirebaseUserChange, signIn, signOut, signUp } from '../../services/authService';
import { storage } from '../../services/storageService';

interface MeResponse {
  uid: string;
  name: string;
  email?: string;
  role: UserRole;
  orgId: string;
}

type GateState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'awaitingRole'; user: User }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

/**
 * In production the whole app sits behind a real Firebase session. The profile
 * (role, org) is read back from the server, which reads it from verified token
 * claims, so a user cannot grant themselves a role from the browser.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>(AUTH_MODE === 'dev' ? { kind: 'ready' } : { kind: 'loading' });

  useEffect(() => {
    if (AUTH_MODE === 'dev') return;
    return onFirebaseUserChange(async (user) => {
      if (!user) return setState({ kind: 'signedOut' });
      setState({ kind: 'loading' });
      try {
        const me = await api<MeResponse>('/api/me');
        const profile: UserProfile = { id: me.uid, name: me.name, email: me.email ?? '', role: me.role, orgId: me.orgId };
        storage.setActiveUser(profile);
        setState({ kind: 'ready' });
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return setState({ kind: 'awaitingRole', user });
        setState({ kind: 'error', message: (err as Error).message });
      }
    });
  }, []);

  if (state.kind === 'ready') return <>{children}</>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center">
            <RadioTower className="w-6 h-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-bold">FieldOps MW</h1>
            <p className="text-sm text-slate-400">Microwave field operations</p>
          </div>
        </header>

        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-slate-300" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Checking your session…
          </p>
        )}
        {state.kind === 'signedOut' && <SignInForm />}
        {state.kind === 'awaitingRole' && (
          <StatusCard
            title="Waiting for access"
            body={`You're signed in as ${state.user.email}. An administrator needs to assign your role before you can see work orders.`}
            action={
              <button
                onClick={() => window.location.reload()}
                className="min-h-11 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold"
              >
                Check again
              </button>
            }
          />
        )}
        {state.kind === 'error' && (
          <StatusCard
            title="Couldn't load your profile"
            body={state.message}
            action={
              <button
                onClick={() => window.location.reload()}
                className="min-h-11 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold"
              >
                Retry
              </button>
            }
          />
        )}
      </div>
    </main>
  );
};

const StatusCard: React.FC<{ title: string; body: string; action: React.ReactNode }> = ({ title, body, action }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="text-sm text-slate-300 leading-relaxed">{body}</p>
    <div className="flex gap-2">
      {action}
      <button
        onClick={() => signOut()}
        className="min-h-11 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" aria-hidden /> Sign out
      </button>
    </div>
  </section>
);

const inputClass =
  'w-full min-h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500';

const SignInForm: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(name, email, password);
    } catch (err) {
      setError(describeAuthError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <h2 className="text-base font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>

      {mode === 'signup' && (
        <label className="block space-y-1.5">
          <span className="text-sm text-slate-300">Full name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-300">Work email</span>
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-300">Password</span>
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />
      </label>

      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full min-h-11 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-sm font-semibold flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />}
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>

      <p className="text-sm text-slate-400 text-center">
        {mode === 'signin' ? 'New to the crew? ' : 'Already have an account? '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
          className="text-cyan-300 underline underline-offset-2"
        >
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      {mode === 'signup' && (
        <p className="text-xs text-slate-400">New accounts get access once an administrator assigns a role.</p>
      )}
    </form>
  );
};
