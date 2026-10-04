'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  User as UserIcon,
  ShieldAlert,
  RotateCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  GraduationCap,
  Briefcase,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Role } from '@/lib/types';

const OTP_EXPIRY_SECONDS = 60;

export function AuthScreen({
  onLogin,
}: {
  onLogin: (
    email: string,
    password: string,
    name?: string,
    hall?: string,
    role?: Role,
    isSignUp?: boolean
  ) => Promise<boolean | void> | void;
}) {
  const { error: dbError } = useData();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [hall, setHall] = useState('');
  const [signupRole, setSignupRole] = useState<'student' | 'staff'>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OTP Verification State
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(OTP_EXPIRY_SECONDS);
  const [otpError, setOtpError] = useState('');

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isVerifyingOtp && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVerifyingOtp, otpTimer]);

  const sendOtpCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpTimer(OTP_EXPIRY_SECONDS);
    setEnteredOtp('');
    setOtpError('');
    setIsVerifyingOtp(true);

    toast.info('University Verification Code', {
      description: `Your 6-digit security code is: ${code} (Valid for ${OTP_EXPIRY_SECONDS}s)`,
      duration: OTP_EXPIRY_SECONDS * 1000,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (mode === 'signup' && !name.trim()) {
      newErrors.name = 'Please enter your full name';
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      newErrors.email = 'Please enter your university email';
    } else if (mode === 'signup') {
      if (signupRole === 'student') {
        if (!cleanEmail.endsWith('@st.university.edu.gh')) {
          const msg =
            'Student accounts must use an official student email address (@st.university.edu.gh)';
          newErrors.email = msg;
          toast.error('Domain Role Mismatch', {
            description: msg,
          });
        }
      } else if (signupRole === 'staff') {
        if (
          !cleanEmail.endsWith('@university.edu.gh') ||
          cleanEmail.includes('@st.')
        ) {
          const msg =
            'Staff accounts must use an official staff email address (@university.edu.gh, not student domain)';
          newErrors.email = msg;
          toast.error('Domain Role Mismatch', {
            description: msg,
          });
        }
      }
    } else {
      if (
        !cleanEmail.includes('@') ||
        (!cleanEmail.endsWith('university.edu.gh') && !cleanEmail.endsWith('.gh'))
      ) {
        newErrors.email =
          'Please enter a valid university email address (@st.university.edu.gh or @university.edu.gh)';
      }
    }

    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (mode === 'signup' && !hall.trim()) {
      newErrors.hall =
        signupRole === 'student'
          ? 'Please enter your assigned residence hall or block'
          : 'Please enter your department or maintenance unit';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (mode === 'signup') {
      sendOtpCode();
    } else {
      setIsSubmitting(true);
      try {
        await onLogin(email.trim(), password.trim());
      } catch (err: any) {
        const msg = err.message || 'Login failed. Please check your credentials.';
        toast.error('Authentication Notice', {
          description: msg,
        });
        setErrors({ general: msg });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpTimer <= 0) {
      setOtpError('This verification code has expired. Please click "Resend Code".');
      return;
    }

    if (enteredOtp.trim() !== generatedOtp) {
      setOtpError('Incorrect verification code. Please check your toast message.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogin(
        email.trim(),
        password.trim(),
        name.trim(),
        hall.trim(),
        signupRole,
        true
      );
      toast.success('Registration verified!', {
        description: `Welcome to CampusFix, ${name.trim()}!`,
      });
    } catch (err: any) {
      setOtpError(err.message || 'Could not complete registration.');
      toast.error('Registration Notice', {
        description: err.message || 'Could not complete registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-grid-subtle px-4 py-10">
      {/* Subtle radial ambient highlight */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.03)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.25)_100%)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-900 text-white font-mono text-base font-bold shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] dark:bg-zinc-100 dark:text-zinc-950">
            CF
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              CampusFix
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              PORTAL
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            University Facilities &amp; Maintenance Operations
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_25px_-5px_rgba(0,0,0,0.03)]">
          {isVerifyingOtp ? (
            /* OTP Verification UI */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-heading text-base font-bold text-foreground">
                    Security Verification
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Enter the code shown in the university notification
                  </p>
                </div>
              </div>

              {/* Timer Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Code Expiration Window
                  </span>
                  <span
                    className={`font-semibold ${
                      otpTimer <= 10 ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    {otpTimer}s remaining
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      otpTimer <= 10 ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${(otpTimer / OTP_EXPIRY_SECONDS) * 100}%` }}
                  />
                </div>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-xs">
                    6-Digit Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="• • • • • •"
                    value={enteredOtp}
                    onChange={(e) => {
                      setEnteredOtp(e.target.value.replace(/\D/g, ''));
                      setOtpError('');
                    }}
                    autoFocus
                    className="text-center font-mono text-xl tracking-widest"
                  />
                  {otpError && (
                    <p className="text-xs text-destructive">{otpError}</p>
                  )}
                  {otpTimer === 0 && (
                    <p className="text-xs text-destructive">
                      Verification code expired. Click resend below for a new code.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={enteredOtp.length < 6 || otpTimer === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating Account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Verify &amp; Activate Account
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsVerifyingOtp(false)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit Information
                </button>
                <button
                  type="button"
                  onClick={sendOtpCode}
                  className="flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Resend Code ({OTP_EXPIRY_SECONDS}s)
                </button>
              </div>
            </div>
          ) : (
            /* Login / Signup Tabs UI */
            <>
              {dbError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Supabase Tables Not Initialized</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Please copy and run <code className="font-mono font-semibold">supabase/schema.sql</code> in your Supabase SQL Editor to create the required tables.
                    </p>
                  </div>
                </div>
              )}

              {errors.general && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{errors.general}</div>
                </div>
              )}

              <div className="mb-5 inline-flex w-full rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs">
                <button
                  onClick={() => {
                    setMode('login');
                    setErrors({});
                  }}
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                    mode === 'login'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMode('signup');
                    setErrors({});
                  }}
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                    mode === 'signup'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="name"
                          autoComplete="name"
                          placeholder="e.g. Ama Mensah"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                          Institutional Role
                        </Label>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {signupRole === 'student'
                            ? '@st.university.edu.gh'
                            : '@university.edu.gh'}
                        </span>
                      </div>

                      {/* Tab selection per role */}
                      <div className="inline-flex w-full rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSignupRole('student');
                            if (errors.email)
                              setErrors((prev) => ({ ...prev, email: '' }));
                          }}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                            signupRole === 'student'
                              ? 'bg-card text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <GraduationCap className="h-4 w-4" />
                          <span>Student</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSignupRole('staff');
                            if (errors.email)
                              setErrors((prev) => ({ ...prev, email: '' }));
                          }}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                            signupRole === 'staff'
                              ? 'bg-card text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Briefcase className="h-4 w-4" />
                          <span>University Staff</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {signupRole === 'student'
                          ? 'Enrolled student reporting facility issues. Requires @st.university.edu.gh email.'
                          : 'Institution & facilities personnel. Requires @university.edu.gh staff email.'}
                      </p>
                      {signupRole === 'student' && (
                        <p className="text-[11px] text-muted-foreground/80 italic">
                          Note: Hall Representatives apply through their student profile settings for administrator review.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">University Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={
                        mode === 'signup'
                          ? signupRole === 'student'
                            ? 'student.id@st.university.edu.gh'
                            : 'staff.name@university.edu.gh'
                          : 'name@st.university.edu.gh or @university.edu.gh'
                      }
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      className="pl-9"
                    />
                  </div>
                  {errors.email ? (
                    <p className="text-xs font-medium text-destructive">{errors.email}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {mode === 'login'
                        ? 'Enter your registered university email'
                        : signupRole === 'student'
                        ? 'Must end with @st.university.edu.gh'
                        : 'Must end with @university.edu.gh'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {mode === 'signup' ? 'Password' : 'Password / Passkey'}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="hall">Hall or Department</Label>
                    <Input
                      id="hall"
                      autoComplete="organization"
                      placeholder="e.g. Pentagon Hall, Computer Science"
                      value={hall}
                      onChange={(e) => setHall(e.target.value)}
                    />
                    {errors.hall && (
                      <p className="text-xs text-destructive">{errors.hall}</p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : mode === 'login' ? (
                    <>
                      Sign In to Portal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue with OTP Verification
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {mode === 'login' ? (
                  <>
                    New student?{' '}
                    <button
                      onClick={() => {
                        setMode('signup');
                        setErrors({});
                      }}
                      type="button"
                      className="font-medium text-primary hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      onClick={() => {
                        setMode('login');
                        setErrors({});
                      }}
                      type="button"
                      className="font-medium text-primary hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          For university members only. Role access governed by University Institution &amp; Administration.
        </p>
      </div>
    </div>
  );
}
