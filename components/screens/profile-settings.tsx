'use client';

import { useState, useMemo } from 'react';
import {
  User as UserIcon,
  Building,
  Shield,
  Check,
  Lock,
  LogOut,
  Mail,
  AlertCircle,
  AlertTriangle,
  Key,
  ShieldCheck,
  Clock,
  Send,
  X,
  Loader2,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { roleLabel, formatDate } from '@/lib/format';
import type { Role } from '@/lib/types';

const roleDescriptions: Record<Role, string> = {
  student:
    'Authorized to report campus maintenance issues, corroborate community reports, and track resolution timelines.',
  rep: 'Authorized to verify and corroborate or dispute maintenance issues reported within your assigned residence hall.',
  staff:
    'Authorized to manage the maintenance operations queue, dispatch technician work orders, log internal progress notes, and resolve tickets.',
  admin:
    'Full administrative governance: user role delegation, campus infrastructure and building catalog management, and system-wide SLA metrics.',
};

export function ProfileSettings({ onLogout }: { onLogout?: () => void }) {
  const {
    currentUser,
    setCurrentUser,
    updateUserProfile,
    logout,
    changePassword,
    hallRepRequests,
    submitHallRepRequest,
    revokeHallRepStatus,
    campusUnits,
  } = useData();

  const residenceHalls = useMemo(
    () => (campusUnits || []).filter((u) => u.category === 'hall'),
    [campusUnits]
  );
  const academicDepts = useMemo(
    () => (campusUnits || []).filter((u) => u.category === 'department'),
    [campusUnits]
  );
  const adminUnits = useMemo(
    () => (campusUnits || []).filter((u) => u.category === 'administrative'),
    [campusUnits]
  );

  const [name, setName] = useState(currentUser.name);
  const [hall, setHall] = useState(currentUser.hall_or_dept);
  const [email] = useState(currentUser.email);
  const [saved, setSaved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Hall Rep Application modal and state
  const [showAppModal, setShowAppModal] = useState(false);
  const [appHall, setAppHall] = useState(currentUser.hall_or_dept || '');
  const [appRoom, setAppRoom] = useState('');
  const [appStatement, setAppStatement] = useState('');
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  // Latest Hall Rep application submitted by this student
  const myLatestRequest = useMemo(() => {
    const userReqs = (hallRepRequests || [])
      .filter((r) => r.student_id === currentUser.id || r.user_id === currentUser.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return userReqs[0] || null;
  }, [hallRepRequests, currentUser.id]);

  const handleApplyRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appHall.trim() || !appRoom.trim() || !appStatement.trim()) {
      toast.error('Please complete all application fields.');
      return;
    }

    setIsSubmittingApp(true);
    try {
      await submitHallRepRequest(
        appHall.trim(),
        appRoom.trim(),
        appStatement.trim()
      );
      setShowAppModal(false);
      setAppRoom('');
      setAppStatement('');
      toast.success('Application Submitted', {
        description:
          'Your Hall Representative request was submitted for Administrator review.',
      });
    } catch (err: any) {
      toast.error('Submission Failed', {
        description: err.message || 'Could not submit application.',
      });
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const [showStepDownModal, setShowStepDownModal] = useState(false);
  const [stepDownReason, setStepDownReason] = useState('');

  const handleConfirmStepDown = async () => {
    setIsResigning(true);
    try {
      await revokeHallRepStatus(currentUser.id, stepDownReason.trim());
      setShowStepDownModal(false);
      setStepDownReason('');
      toast.info('Role Restored to Student', {
        description:
          'You have successfully stepped down as Hall Representative.',
      });
    } catch (err: any) {
      toast.error('Action Failed', {
        description: err.message || 'Could not update role.',
      });
    } finally {
      setIsResigning(false);
    }
  };

  // Password reset state for temp passkey
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwdError, setPwdError] = useState('');

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfile(currentUser.id, {
        name: cleanName,
        hall_or_dept: hall,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      toast.error('Failed to Save Profile', {
        description: err.message || 'Could not update profile in database.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwdError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }

    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPwdError('');

      toast.success('Password Updated', {
        description: 'Your account is now secured with your new password in Supabase.',
      });
    } catch (err: any) {
      setPwdError(err.message || 'Could not update password.');
      toast.error('Password Update Failed', {
        description: err.message || 'Could not update password.',
      });
    }
  };

  const handleSignOut = async () => {
    await logout();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              Profile &amp; Account Settings
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              ACCOUNT
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage your personal university profile, credentials, and view your assigned role.
          </p>
        </div>
      </div>

      {/* Temporary Passkey Alert & Password Change Form */}
      {currentUser.requiresPasswordChange && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="font-heading text-sm font-bold text-amber-900">
                Temporary Onboarding Passkey Active: Action Required
              </h2>
              <p className="text-xs text-amber-800 leading-relaxed">
                You are currently signed in with an administrator-issued temporary password. Please set your permanent university password below to secure your technician account.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="mt-4 space-y-3 pt-3 border-t border-amber-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-pwd" className="text-xs font-semibold text-amber-950">
                  New Permanent Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPwdError('');
                    }}
                    className="bg-card text-sm pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-900/60 hover:text-amber-950 focus:outline-none"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conf-pwd" className="text-xs font-semibold text-amber-950">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="conf-pwd"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPwdError('');
                    }}
                    className="bg-card text-sm pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-900/60 hover:text-amber-950 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {pwdError && <p className="text-xs font-medium text-destructive">{pwdError}</p>}

            <div className="pt-1 flex justify-end">
              <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                <Key className="mr-1.5 h-4 w-4" />
                Activate Permanent Password
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Profile info */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Account Information
          </h2>
          <span className="text-xs text-muted-foreground">Editable details</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">University Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              value={email}
              disabled
              className="pl-9 bg-muted/40 text-muted-foreground cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Linked to your official university registry identity
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hall-select">Hall or Department</Label>
          <Select value={hall} onValueChange={setHall}>
            <SelectTrigger id="hall-select" className="w-full text-xs">
              <SelectValue placeholder="Select official residence hall or department" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {residenceHalls.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-primary">
                    Residence Halls
                  </SelectLabel>
                  {residenceHalls.map((u) => (
                    <SelectItem key={u.id} value={u.name} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {academicDepts.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-primary">
                    Academic Departments
                  </SelectLabel>
                  {academicDepts.map((u) => (
                    <SelectItem key={u.id} value={u.name} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {adminUnits.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-primary">
                    Administrative &amp; General Units
                  </SelectLabel>
                  {adminUnits.map((u) => (
                    <SelectItem key={u.id} value={u.name} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {hall && !campusUnits.some((u) => u.name === hall) && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground">
                    Current Assigned
                  </SelectLabel>
                  <SelectItem value={hall} className="text-xs">
                    {hall}
                  </SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Official campus unit registered for incident reporting and notifications
          </p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={isSavingProfile} className="w-full sm:w-auto">
            {isSavingProfile ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Changes Saved
              </>
            ) : (
              'Save Profile'
            )}
          </Button>
        </div>
      </div>

      {/* Role & Institutional Permissions (Read-Only) */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              Institutional Role &amp; Access
            </h2>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Read-only
          </span>
        </div>

        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-heading font-semibold text-base text-foreground">
                {roleLabel(currentUser.role)}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Active
              </span>
            </div>
            {currentUser.role === 'rep' && (
              <span className="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 px-2 py-0.5 rounded">
                {currentUser.hall_or_dept}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {roleDescriptions[currentUser.role]}
          </p>
        </div>

        {/* Hall Rep Application / Status for Students */}
        {currentUser.role === 'student' && (
          <div className="pt-1">
            {myLatestRequest && myLatestRequest.status === 'pending' ? (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Hall Representative Application Under Review
                  </span>
                </div>
                <p className="text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed">
                  Your application to represent <span className="font-semibold">{myLatestRequest.hall}</span> has been received. University Administration is reviewing your submission. You will be notified once a decision is made.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Submitted: {formatDate(myLatestRequest.created_at)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                    Awaiting Review
                  </span>
                </div>
              </div>
            ) : myLatestRequest && myLatestRequest.status === 'stepped_down' ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <RotateCcw className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Appointment Concluded (Stepped Down)
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                    Stepped Down
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You previously served as the appointed Hall Representative for <span className="font-semibold text-foreground">{myLatestRequest.hall}</span>. Your account has returned to standard Student access.
                </p>
                {myLatestRequest.rejection_reason && (
                  <p className="text-xs text-muted-foreground italic">
                    Resignation Record: &ldquo;{myLatestRequest.rejection_reason}&rdquo;
                  </p>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Concluded: {myLatestRequest.reviewed_at ? formatDate(myLatestRequest.reviewed_at) : formatDate(myLatestRequest.created_at)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAppModal(true)}
                    className="text-xs gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Re-apply for Hall Rep
                  </Button>
                </div>
              </div>
            ) : myLatestRequest && myLatestRequest.status === 'rejected' ? (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Previous Application Status
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Declined
                  </span>
                </div>
                {myLatestRequest.rejection_reason && (
                  <p className="text-xs text-muted-foreground italic">
                    Feedback from Administration: &ldquo;{myLatestRequest.rejection_reason}&rdquo;
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    You may submit an updated application with revised hall details.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAppModal(true)}
                    className="text-xs gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Re-apply for Hall Rep
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Apply for Hall Representative
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hall Representatives are verified student leaders appointed by University Administration to authenticate and prioritize maintenance tickets within their residence hall.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAppModal(true)}
                  className="text-xs gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Submit Hall Rep Application
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Rep Resignation / Management for Appointed Reps */}
        {currentUser.role === 'rep' && (
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Residence Hall Appointment
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Active Verification Role
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You are the designated representative for <span className="font-semibold text-foreground">{currentUser.hall_or_dept}</span>. You have authority to corroborate, verify, or dispute reported facility issues in your hall.
            </p>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isResigning}
                onClick={() => setShowStepDownModal(true)}
                className="text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
              >
                {isResigning ? 'Processing...' : 'Step Down as Hall Representative'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg bg-accent/40 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span>
            Institutional role credentials and administrative elevations are managed by Campus Administration &amp; Student Affairs.
          </span>
        </div>
      </div>

      {/* Hall Rep Application Dialog Modal */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-5 animate-scale-up">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-base font-bold text-foreground">
                    Hall Representative Application
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Submit your candidacy for administrator review and appointment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAppModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApplyRep} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="app-hall-select" className="text-xs font-semibold">
                  Official Residence Hall
                </Label>
                <Select value={appHall} onValueChange={setAppHall}>
                  <SelectTrigger id="app-hall-select" className="w-full text-xs">
                    <SelectValue placeholder="Select official residence hall to represent" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-primary">
                        Campus Residence Halls
                      </SelectLabel>
                      {residenceHalls.map((u) => (
                        <SelectItem key={u.id} value={u.name} className="text-xs">
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {appHall && !residenceHalls.some((u) => u.name === appHall) && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">
                          Other Assigned
                        </SelectLabel>
                        <SelectItem value={appHall} className="text-xs">
                          {appHall}
                        </SelectItem>
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The primary campus residence hall you reside in and wish to represent.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-room" className="text-xs font-semibold">
                  Room or Flat Number
                </Label>
                <Input
                  id="app-room"
                  placeholder="e.g. Room 304, Block B"
                  value={appRoom}
                  onChange={(e) => setAppRoom(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-statement" className="text-xs font-semibold">
                  Statement of Intent / Leadership Motivation
                </Label>
                <Textarea
                  id="app-statement"
                  placeholder="Explain why you wish to serve as Hall Representative and how you plan to assist campus facilities in verifying and tracking maintenance issues..."
                  value={appStatement}
                  onChange={(e) => setAppStatement(e.target.value)}
                  rows={4}
                  className="text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Administrators evaluate this statement during review.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAppModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingApp}
                  className="text-xs gap-1.5"
                >
                  {isSubmittingApp ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Submit Application
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step Down Confirmation Dialog Modal */}
      {showStepDownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground">
                    Step Down as Hall Representative
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Vacate appointment for {currentUser.hall_or_dept}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isResigning) {
                    setShowStepDownModal(false);
                    setStepDownReason('');
                  }
                }}
                disabled={isResigning}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3.5 space-y-2 text-xs text-foreground/90">
              <p className="font-medium text-destructive">
                Please confirm this role transition:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                <li>Your account access will immediately return to <strong>Student</strong>.</li>
                <li>You will no longer be able to verify or dispute reports in {currentUser.hall_or_dept}.</li>
                <li>Your access to the Hall Rep verification queue will be removed.</li>
                <li>University Administration records will update to reflect your stepped-down status.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stepdown-reason" className="text-xs font-semibold">
                Reason or Transition Note (Optional)
              </Label>
              <Textarea
                id="stepdown-reason"
                placeholder="e.g. Completed term, graduating semester, academic commitments..."
                value={stepDownReason}
                onChange={(e) => setStepDownReason(e.target.value)}
                disabled={isResigning}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isResigning}
                onClick={() => {
                  setShowStepDownModal(false);
                  setStepDownReason('');
                }}
                className="text-xs"
              >
                Keep My Role
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isResigning}
                onClick={handleConfirmStepDown}
                className="text-xs gap-1.5"
              >
                {isResigning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Stepping Down...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Confirm Step Down
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Session Management */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Session &amp; Security
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign out of this browser session when using shared campus lab computers or facilities desks.
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out of CampusFix
          </Button>
        </div>
      </div>
    </div>
  );
}
