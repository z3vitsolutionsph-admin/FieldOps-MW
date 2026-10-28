import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  AUTH_MODE,
  onFirebaseUserChange,
  signIn,
  signUp,
  signOut,
  describeAuthError,
  getAuthToken,
} from '../../services/authService';
import { api, ApiError } from '../../services/apiClient';
import { storage } from '../../services/storageService';
import { UserProfile, UserRole } from '../../types/fieldops';
import { Shield, Radio, AlertCircle, Clock, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

interface MeResponse {
  uid: string;
  name: string;
  email?: string;
  role: UserRole;
  orgId: string;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  if (AUTH_MODE === 'dev') {
    return <>{children}</>;
  }

  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [accessError, setAccessError] = useState<{ status: number; message: string } | null>(null);

  // Form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingMe, setVerifyingMe] = useState(false);

  useEffect(() => {
    const unsubscribe = onFirebaseUserChange(async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserProfile(user, false);
      } else {
        setProfileReady(false);
        setAccessError(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (user: User, forceRefresh: boolean) => {
    setVerifyingMe(true);
    setAccessError(null);
    try {
      if (forceRefresh) {
        await getAuthToken(true);
      }
      const me = await api<MeResponse>('/api/me');
      if (me && me.role) {
        const profile: UserProfile = {
          id: me.uid,
          name: me.name || user.displayName || 'FieldOps Specialist',
          email: me.email || user.email || '',
          role: me.role,
          orgId: me.orgId,
          status: 'AVAILABLE',
        };
        storage.setActiveUser(profile);
        setProfileReady(true);
        setAccessError(null);
      } else {
        setAccessError({
          status: 403,
          message: 'Your account has not been assigned a role yet.',
        });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setAccessError({ status: err.status, message: err.message });
      } else {
        setAccessError({
          status: 500,
          message: err?.message || 'Unable to connect to FieldOps authorization gateway.',
        });
      }
    } finally {
      setVerifyingMe(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setFormError('Full name is required to create an account.');
          setSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setFormError('Password must be at least 8 characters long.');
          setSubmitting(false);
          return;
        }
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setFormError(describeAuthError(err));
      setSubmitting(false);
    }
  };

  // 1. Initial Authentication Check Loading State
  if (loading || (firebaseUser && verifyingMe && !profileReady && !accessError)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-6 shadow-xl shadow-cyan-500/10 animate-pulse">
          <Radio className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold font-mono tracking-wider text-slate-100">
          FIELDOPS <span className="text-cyan-400">TELECOM</span>
        </h2>
        <p className="text-xs font-mono text-cyan-500/80 mt-2 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Verifying security claims and credentials...
        </p>
      </div>
    );
  }

  // 2. Access Pending / Missing Role Screen (HTTP 403)
  if (firebaseUser && accessError?.status === 403) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400 mx-auto">
            <Clock className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-center text-slate-100 font-mono">
            Waiting for Access Authorization
          </h2>
          <p className="text-sm text-slate-400 text-center mt-2">
            Your account <span className="text-white font-mono font-medium">{firebaseUser.email}</span> is authenticated, but an administrator needs to assign your role before you can access the system.
          </p>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 mt-5">
            <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
              Required Action
            </div>
            <div className="text-xs text-slate-300">
              Provide your email to your telecom project manager or administrator so they can configure your organization and operational role claims.
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => loadUserProfile(firebaseUser, true)}
              disabled={verifyingMe}
              className="min-h-[44px] min-w-[44px] w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${verifyingMe ? 'animate-spin' : ''}`} />
              {verifyingMe ? 'Refreshing token...' : 'Check again'}
            </button>

            <button
              onClick={() => signOut()}
              className="min-h-[44px] min-w-[44px] w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Other Gateway Connection Errors
  if (firebaseUser && accessError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
          <div className="w-14 h-14 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 text-rose-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-center text-slate-100 font-mono">
            Gateway Authorization Error
          </h2>
          <p className="text-sm text-slate-400 text-center mt-2">
            {accessError.message}
          </p>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => loadUserProfile(firebaseUser, true)}
              disabled={verifyingMe}
              className="min-h-[44px] min-w-[44px] w-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${verifyingMe ? 'animate-spin' : ''}`} />
              Try again
            </button>

            <button
              onClick={() => signOut()}
              className="min-h-[44px] min-w-[44px] w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated and Authorized -> Render Application
  if (firebaseUser && profileReady) {
    return <>{children}</>;
  }

  // 5. Signed Out -> Sign In / Create Account Screen
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              FIELDOPS <span className="text-cyan-400">MW</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Production Enterprise Access</p>
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setFormError(null);
            }}
            className={`min-h-[44px] flex-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isSignUp
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setFormError(null);
            }}
            className={`min-h-[44px] flex-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isSignUp
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-5 p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-300 text-xs animate-shake"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                Full Name
              </label>
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                required={isSignUp}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engr. Juan Dela Cruz"
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
              Work Email Address
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="technician@telecom.ph"
              className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
              Password {isSignUp && <span className="text-slate-500">(min. 8 characters)</span>}
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-600/25 mt-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isSignUp ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Production Account</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Sign In to FieldOps MW</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Enterprise Cloud RBAC</span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Online v4.0
          </span>
        </div>
      </div>
    </div>
  );
};
