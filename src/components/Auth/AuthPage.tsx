import React, { useState } from 'react';
import { signInWithOtp, verifyOtp } from '../../lib/gotrue';
import { Mail, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'success';

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('unexpected_failure') || lower.includes('sending') || lower.includes('magic link')) {
    return 'SMTP delivery failed. Check: (1) Site URL is set in Supabase Dashboard → Auth → URL Config, (2) sender domain is verified with your SMTP provider, (3) SMTP port matches TLS mode (587=STARTTLS, 465=SSL).';
  }
  if (lower.includes('otp') || lower.includes('invalid') || lower.includes('expired') || lower.includes('token')) {
    return 'Invalid or expired code. Codes expire after 10 minutes — request a new one.';
  }
  if (lower.includes('rate') || lower.includes('limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return msg || 'Something went wrong. Please try again.';
}

export default function AuthPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const startResendTimer = () => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithOtp(email.trim().toLowerCase());
      setStep('otp');
      startResendTimer();
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), otp.trim());
      setStep('success');
    } catch (err: unknown) {
      setError(friendlyError(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithOtp(email.trim().toLowerCase());
      startResendTimer();
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-xl shadow-indigo-900/50 mb-4">
            <span className="text-white text-2xl font-bold">V</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vyaparimay</h1>
          <p className="text-slate-400 text-sm mt-1">Flour Mill Management</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">Sign in</h2>
                <p className="text-slate-400 text-sm">Enter your email to receive a one-time password.</p>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <>Send OTP <ArrowRight size={15} /></>
                )}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">Enter OTP</h2>
                <p className="text-slate-400 text-sm">
                  A 6-digit code was sent to <span className="text-slate-300 font-medium">{email}</span>.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  One-time password
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="00000000"
                  className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 8}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <>Verify &amp; Sign in <ArrowRight size={15} /></>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(null); }}
                  className="text-slate-400 hover:text-slate-200 text-xs transition-colors"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || loading}
                  className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 disabled:cursor-not-allowed text-xs transition-colors"
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-2 space-y-3">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
              <div>
                <h2 className="text-white font-semibold text-lg">Signed in!</h2>
                <p className="text-slate-400 text-sm mt-1">Loading your workspace…</p>
              </div>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400 mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
