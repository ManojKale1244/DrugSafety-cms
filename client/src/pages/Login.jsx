import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Activity,
  Layers,
  ChevronRight,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@drugsafety.local', pass: 'Admin@123456', desc: 'Full System Admin' },
  { role: 'Case Manager', email: 'manager@drugsafety.local', pass: 'Manager@123456', desc: 'Triage & Workload' },
  { role: 'Reviewer', email: 'reviewer@drugsafety.local', pass: 'Reviewer@123456', desc: 'Medical Review' },
  { role: 'Data Entry', email: 'dataentry@drugsafety.local', pass: 'DataEntry@123456', desc: 'Adverse Event Intake' },
  { role: 'QA Auditor', email: 'qa@drugsafety.local', pass: 'QaSpec@123456', desc: 'Compliance Logs' },
  { role: 'Regulatory', email: 'regulatory@drugsafety.local', pass: 'RegAffairs@123456', desc: 'Periodic Reporting' },
  { role: 'Viewer', email: 'viewer@drugsafety.local', pass: 'Viewer@123456', desc: 'Read-only Access' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  // Forgot password & reset password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(null);
  const [devToken, setDevToken] = useState(null);

  // Reset password form state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLocked(false);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      setErrorMessage(data?.error || 'Authentication failed. Please verify credentials.');
      if (data?.isLocked) {
        setIsLocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setErrorMessage('');
    setIsLocked(false);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess(null);
    setErrorMessage('');

    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(res.data.message);
      if (res.data.devResetToken) {
        setDevToken(res.data.devResetToken);
      }
    } catch (_err) {
      setForgotSuccess('If an active account exists, password instructions have been dispatched.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');

    try {
      const res = await api.post('/auth/reset-password', {
        token: resetToken,
        password: newPassword,
        confirmPassword,
      });
      setResetSuccess(res.data.message || 'Password updated successfully! You may now sign in.');
      setTimeout(() => {
        setShowResetModal(false);
        setPassword(newPassword);
      }, 2000);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-900">
      {/* ── Left: Brand Panel with Animated Gradient ────────── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-slate-900 to-indigo-950 p-12 text-white lg:flex">
        {/* Animated Background Orbs */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl animate-pulse delay-1000" />

        {/* Top Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md border border-white/15">
            <Shield className="h-6 w-6 text-brand-400" />
            <span className="font-bold text-lg tracking-tight text-white">Drug Safety CMS</span>
            <span className="rounded-full bg-brand-500/30 px-2 py-0.5 text-xs font-semibold text-brand-200">
              v1.0
            </span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/20 mb-4">
              <Activity className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
              Pharmacovigilance Intelligence Platform
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
              Next-Generation Adverse Event Case Management
            </h1>
            <p className="mt-4 text-base text-slate-300 leading-relaxed">
              Real-time case intake, automated regulatory triage, immutable audit trails, and strict role-based governance compliant with global safety standards.
            </p>
          </motion.div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <Layers className="h-5 w-5 text-brand-400 mb-2" />
              <div className="font-semibold text-sm text-white">7 RBAC Safety Roles</div>
              <div className="text-xs text-slate-400 mt-1">Granular authorization enforced server-side</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <FileCheck2 className="h-5 w-5 text-emerald-400 mb-2" />
              <div className="font-semibold text-sm text-white">Immutable Audit Trail</div>
              <div className="text-xs text-slate-400 mt-1">Non-repudiable event logs for all changes</div>
            </div>
          </div>
        </div>

        {/* Demo Fast-Login Selector */}
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Quick Fill Demo Accounts (Click to test role):
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DEMO_ACCOUNTS.slice(0, 4).map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className="group flex flex-col items-start rounded-lg bg-white/5 p-2 text-left hover:bg-brand-600/30 border border-white/5 hover:border-brand-500/50 transition-all"
              >
                <span className="text-xs font-semibold text-brand-200 group-hover:text-white flex items-center justify-between w-full">
                  {acc.role}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-[10px] text-slate-400 truncate w-full">{acc.desc}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {DEMO_ACCOUNTS.slice(4).map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className="group flex flex-col items-start rounded-lg bg-white/5 p-2 text-left hover:bg-brand-600/30 border border-white/5 hover:border-brand-500/50 transition-all"
              >
                <span className="text-xs font-semibold text-brand-200 group-hover:text-white flex items-center justify-between w-full">
                  {acc.role}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-[10px] text-slate-400 truncate w-full">{acc.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Left Panel Copyright Footer */}
        <div className="relative z-10 pt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} Drug Safety CMS — Pharmacovigilance Platform. All rights reserved.
        </div>
      </div>

      {/* ── Right: Login Form Panel ─────────────────────────── */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
                <Shield className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold text-slate-900">Drug Safety CMS</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome Back</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in with your enterprise credentials to access pharmacovigilance records
            </p>
          </div>

          {/* Lockout / Error Message Banner */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-6 rounded-xl border p-4 text-sm ${
                  isLocked
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isLocked ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <h4 className="font-semibold">{isLocked ? 'Account Temporarily Locked' : 'Authentication Error'}</h4>
                    <p className="mt-0.5 text-xs leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@drugsafety.local"
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input-field pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Sign In Securely
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons on Mobile */}
          <div className="mt-8 border-t border-slate-100 pt-6 lg:hidden">
            <p className="text-xs font-semibold text-slate-500 mb-2">Demo Accounts:</p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {acc.role}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center space-y-1.5 text-xs">
            <p className="font-medium text-slate-500">
              © {new Date().getFullYear()} Drug Safety CMS — Pharmacovigilance Platform. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-400">
              🔒 Protected by httpOnly secure cookie session, bcrypt 12-round hashing, and automated account lockout.
            </p>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Reset Your Password</h3>
                  <p className="text-xs text-slate-500">We'll generate a secure reset token</p>
                </div>
              </div>

              {forgotSuccess ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900">Request Processed</p>
                      <p className="mt-1">{forgotSuccess}</p>
                    </div>
                  </div>

                  {devToken && (
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900 mb-1">Development Reset Token:</p>
                      <code className="block bg-white p-2 rounded border border-slate-200 break-all font-mono text-[11px] text-brand-600 select-all">
                        {devToken}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setResetToken(devToken);
                          setShowForgotModal(false);
                          setShowResetModal(true);
                        }}
                        className="btn-primary mt-3 w-full text-xs py-2"
                      >
                        Proceed to Reset Form with this Token
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn-secondary w-full"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Email
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@drugsafety.local"
                      className="input-field"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-primary"
                    >
                      {forgotLoading ? 'Processing…' : 'Generate Reset Token'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reset Password Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
            >
              <h3 className="font-bold text-lg text-slate-900 mb-1">Enter New Password</h3>
              <p className="text-xs text-slate-500 mb-4">
                Must be at least 8 characters, include upper, lower, numbers & symbols, and not match your last 5 passwords.
              </p>

              {resetError && (
                <div className="mb-4 rounded-xl bg-red-50 p-3 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="mb-4 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="input-field font-mono text-xs"
                    placeholder="Paste 64-character token"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    placeholder="New strong password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field"
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-primary"
                  >
                    {resetLoading ? 'Saving…' : 'Set New Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
