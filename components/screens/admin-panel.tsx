'use client';

import { useState, useMemo } from 'react';
import {
  Users,
  MapPin,
  BarChart3,
  Shield,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  History,
  ShieldCheck,
  UserPlus,
  Key,
  Copy,
  Search,
  Check,
  Building,
  Layers,
  ArrowRight,
  Activity,
  Ban,
  UserCheck,
  Edit3,
  Trash2,
  Archive,
  RotateCcw,
  FileText,
  XCircle,
  X,
  MessageSquare,
  Filter,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data-context';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  categoryLabel,
  buildingTypeLabel,
  roleLabel,
  daysSince,
  formatDate,
  formatWorkOrderToken,
  formatReportToken,
  matchTicketSearch,
} from '@/lib/format';
import type { Role, BuildingType, Category, HallRepRequest, User, Report, Location } from '@/lib/types';
import type { ScreenName } from '@/components/shared/app-shell';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';

export type AdminView =
  | 'analytics'
  | 'users'
  | 'rep-requests'
  | 'reports'
  | 'onboarding'
  | 'locations'
  | 'audit';

export function AdminPanel({
  view = 'analytics',
  onNavigate,
}: {
  view?: AdminView;
  onNavigate?: (screen: ScreenName) => void;
}) {
  const {
    currentUser,
    users,
    reports,
    locations,
    statusEvents,
    updateUserRole,
    onboardStaff,
    addLocation,
    updateLocation,
    deleteLocation,
    hallRepRequests,
    reviewHallRepRequest,
    revokeHallRepStatus,
    banUser,
    unbanUser,
    updateUserProfile,
    deleteUserProfile,
    archiveReport,
    restoreReport,
  } = useData();

  // Location form
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<BuildingType>('residence');

  // Staff Onboarding form
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDept, setStaffDept] = useState('Plumbing & Pipe Services');
  const [tempPasskey, setTempPasskey] = useState(() =>
    'STAFF-' + Math.floor(1000 + Math.random() * 9000).toString()
  );

  // User search, role filter & moderation modal states
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDept, setEditDept] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [banningUser, setBanningUser] = useState<User | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [isProcessingBan, setIsProcessingBan] = useState(false);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Hall Rep Requests View state
  const [repReqSearch, setRepReqSearch] = useState('');
  const [repReqFilter, setRepReqFilter] = useState<
    'all' | 'pending' | 'approved' | 'revoked' | 'stepped_down' | 'rejected'
  >('all');
  const [decliningReq, setDecliningReq] = useState<HallRepRequest | null>(null);
  const [declineFeedback, setDeclineFeedback] = useState('');
  const [revokingRepUser, setRevokingRepUser] = useState<{
    userId: string;
    name: string;
    requestId?: string;
    hall?: string;
  } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isProcessingRepAction, setIsProcessingRepAction] = useState(false);

  // Report Moderation state
  const [reportSearch, setReportSearch] = useState('');
  const [reportArchiveFilter, setReportArchiveFilter] = useState<
    'all' | 'active' | 'archived'
  >('all');
  const [archivingReport, setArchivingReport] = useState<Report | null>(null);
  const [archiveReasonInput, setArchiveReasonInput] = useState('');
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  // Location editing & deletion state
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocType, setEditLocType] = useState<BuildingType>('residence');
  const [isSavingLoc, setIsSavingLoc] = useState(false);

  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [isDeletingLoc, setIsDeletingLoc] = useState(false);

  const openEditLocation = (loc: Location) => {
    setEditingLocation(loc);
    setEditLocName(loc.name);
    setEditLocType(loc.building_type);
  };

  const handleSaveLocation = async () => {
    if (!editingLocation || !editLocName.trim()) return;
    setIsSavingLoc(true);
    try {
      await updateLocation(editingLocation.id, editLocName.trim(), editLocType);
      toast.success('Location Updated', {
        description: `"${editLocName.trim()}" has been updated successfully.`,
      });
      setEditingLocation(null);
    } catch (err: any) {
      toast.error('Failed to update location', {
        description: err.message || 'An error occurred while saving.',
      });
    } finally {
      setIsSavingLoc(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return;
    setIsDeletingLoc(true);
    try {
      await deleteLocation(deletingLocation.id);
      toast.success('Location Removed', {
        description: `"${deletingLocation.name}" has been deleted from the catalog.`,
      });
      setDeletingLocation(null);
    } catch (err: any) {
      toast.error('Failed to delete location', {
        description: err.message || 'An error occurred while deleting.',
      });
    } finally {
      setIsDeletingLoc(false);
    }
  };

  const generateNewPasskey = () => {
    const key = 'STAFF-' + Math.floor(1000 + Math.random() * 9000).toString();
    setTempPasskey(key);
  };

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !tempPasskey.trim()) {
      toast.error('Please fill in all staff details.');
      return;
    }

    if (!staffEmail.includes('@')) {
      toast.error('Please provide a valid university staff email.');
      return;
    }

    const created = onboardStaff(
      staffName.trim(),
      staffEmail.trim(),
      staffDept.trim(),
      tempPasskey.trim()
    );

    toast.success('Staff Member Onboarded', {
      description: `${created.name} provisioned with temporary passkey: ${tempPasskey}`,
    });

    // Reset form with new passkey
    setStaffName('');
    setStaffEmail('');
    generateNewPasskey();
  };

  const copyCredentials = (email: string, passkey?: string) => {
    const text = `University Staff Portal Credentials\nEmail: ${email}\nTemporary Passkey: ${passkey || 'Active Password'}\nURL: /`;
    navigator.clipboard.writeText(text);
    toast.info('Credentials Copied', {
      description: `Copied login details for ${email} to clipboard`,
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchDept = u.hall_or_dept.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDept) return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, userSearch, roleFilter]);

  const isRevokedReq = (req: HallRepRequest) => {
    if (req.status === 'approved' || req.status === 'pending') return false;
    const reason = (req.rejection_reason || req.admin_notes || '').toLowerCase();
    const reviewer = (req.reviewed_by || '').toLowerCase();
    return (
      reason.includes('revok') ||
      reason.includes('concluded') ||
      reason.includes('terminated') ||
      reason.includes('administrative') ||
      (reviewer !== '' && !reviewer.includes('self') && req.status === 'stepped_down')
    );
  };

  const isSteppedDownReq = (req: HallRepRequest) => {
    if (req.status === 'approved' || req.status === 'pending') return false;
    if (isRevokedReq(req)) return false;
    const reason = (req.rejection_reason || req.admin_notes || '').toLowerCase();
    const reviewer = (req.reviewed_by || '').toLowerCase();
    return (
      req.status === 'stepped_down' ||
      reviewer.includes('self') ||
      reason.includes('stepped down') ||
      reason.includes('resigned')
    );
  };

  const isDeclinedReq = (req: HallRepRequest) => {
    if (req.status === 'approved' || req.status === 'pending') return false;
    return !isRevokedReq(req) && !isSteppedDownReq(req);
  };

  const filteredRepRequests = useMemo(() => {
    return (hallRepRequests || []).filter((req) => {
      if (repReqFilter === 'pending' && req.status !== 'pending') return false;
      if (repReqFilter === 'approved' && req.status !== 'approved') return false;
      if (repReqFilter === 'revoked' && !isRevokedReq(req)) return false;
      if (repReqFilter === 'stepped_down' && !isSteppedDownReq(req)) return false;
      if (repReqFilter === 'rejected' && !isDeclinedReq(req)) return false;

      if (repReqSearch.trim()) {
        const q = repReqSearch.toLowerCase();
        const matchName = (req.user_name || '').toLowerCase().includes(q);
        const matchEmail = (req.user_email || '').toLowerCase().includes(q);
        const matchHall = (req.hall || '').toLowerCase().includes(q);
        const matchStmt = (req.statement || '').toLowerCase().includes(q);
        const matchReason = (req.rejection_reason || '').toLowerCase().includes(q);
        if (
          !matchName &&
          !matchEmail &&
          !matchHall &&
          !matchStmt &&
          !matchReason
        )
          return false;
      }
      return true;
    });
  }, [hallRepRequests, repReqFilter, repReqSearch]);

  const filteredModerationReports = useMemo(() => {
    return (reports || []).filter((r) => {
      if (reportArchiveFilter === 'active' && r.is_archived) return false;
      if (reportArchiveFilter === 'archived' && !r.is_archived) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchLoc = r.location_name.toLowerCase().includes(q);
        const matchStudent = r.student_name.toLowerCase().includes(q);
        const matchTicket = matchTicketSearch(r.id, reportSearch);
        if (!matchDesc && !matchLoc && !matchStudent && !matchTicket)
          return false;
      }
      return true;
    });
  }, [reports, reportArchiveFilter, reportSearch]);

  const onboardedStaffList = useMemo(() => {
    return users.filter((u) => u.role === 'staff');
  }, [users]);

  const stats = useMemo(() => {
    const open = reports.filter((r) => r.status === 'open').length;
    const inProgress = reports.filter((r) => r.status === 'in_progress').length;
    const resolved = reports.filter((r) => r.status === 'resolved').length;
    const avgScore = reports.length
      ? Math.round(
          (reports.reduce((s, r) => s + r.verification_score, 0) / reports.length) * 10
        ) / 10
      : 0;
    const resolutionRate = reports.length
      ? Math.round((resolved / reports.length) * 100)
      : 0;
    const avgResolutionDays = resolved
      ? (() => {
          const resolvedReports = reports.filter((r) => r.status === 'resolved');
          const days = resolvedReports.map((r) => daysSince(r.created_at));
          return days.length
            ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10
            : 0;
        })()
      : 0;

    return {
      total: reports.length,
      open,
      inProgress,
      resolved,
      avgScore,
      resolutionRate,
      avgResolutionDays,
      totalUsers: users.length,
      totalLocations: locations.length,
      totalStaff: users.filter((u) => u.role === 'staff').length,
    };
  }, [reports, users, locations]);

  const categoryStats = useMemo(() => {
    const counts: Record<Category, number> = {
      electrical: 0,
      plumbing: 0,
      structural: 0,
      sanitation: 0,
      other: 0,
    };
    reports.forEach((r) => {
      if (counts[r.category] !== undefined) counts[r.category]++;
    });
    return counts;
  }, [reports]);

  const signalHealth = useMemo(() => {
    const high = reports.filter((r) => r.verification_score >= 15).length;
    const medium = reports.filter(
      (r) => r.verification_score >= 5 && r.verification_score < 15
    ).length;
    const low = reports.filter((r) => r.verification_score < 5).length;
    return { high, medium, low };
  }, [reports]);

  const [auditSearch, setAuditSearch] = useState('');

  const filteredAuditEvents = useMemo(() => {
    const list = statusEvents.slice().reverse();
    if (!auditSearch.trim()) return list;
    const q = auditSearch.toLowerCase();
    return list.filter((e) => {
      const r = reports.find((item) => item.id === e.report_id);
      const matchLoc = r?.location_name.toLowerCase().includes(q);
      const matchActor = e.actor_name?.toLowerCase().includes(q);
      const matchNote = e.note?.toLowerCase().includes(q);
      const matchRole = e.actor_role?.toLowerCase().includes(q);
      const matchTicket = matchTicketSearch(e.report_id, auditSearch);
      return matchLoc || matchActor || matchNote || matchRole || matchTicket;
    });
  }, [statusEvents, reports, auditSearch]);

  // Pagination Controllers
  const repReqPagination = usePagination(filteredRepRequests, {
    pageSize: 10,
    resetDeps: [repReqSearch, repReqFilter],
  });

  const usersPagination = usePagination(filteredUsers, {
    pageSize: 10,
    resetDeps: [userSearch, roleFilter],
  });

  const reportsPagination = usePagination(filteredModerationReports, {
    pageSize: 10,
    resetDeps: [reportSearch, reportArchiveFilter],
  });

  const auditPagination = usePagination(filteredAuditEvents, {
    pageSize: 15,
    resetDeps: [auditSearch],
  });

  const locationsPagination = usePagination(locations, {
    pageSize: 9,
  });

  const handleAddLocation = () => {
    if (newLocName.trim().length < 3) return;
    addLocation(newLocName.trim(), newLocType);
    setNewLocName('');
    toast.success('Location Added', {
      description: `${newLocName.trim()} added to campus directory.`,
    });
  };

  const exportSystemCSV = () => {
    const headers = [
      'Report ID',
      'Location',
      'Category',
      'Reporter',
      'Verification Score',
      'Status',
      'Created Date',
      'Description',
    ];
    const rows = reports.map((r) => [
      `"${r.id}"`,
      `"${r.location_name.replace(/"/g, '""')}"`,
      `"${r.category}"`,
      `"${r.student_name.replace(/"/g, '""')}"`,
      r.verification_score,
      `"${r.status}"`,
      `"${r.created_at}"`,
      `"${r.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `campus-system-summary-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAuditCSV = () => {
    const headers = [
      'Timestamp',
      'Context / Location',
      'Changed By (Actor)',
      'Actor Role',
      'Status Event',
      'Operational Note',
    ];
    const rows = statusEvents.slice().reverse().map((e) => {
      const r = reports.find((item) => item.id === e.report_id);
      return [
        `"${formatDate(e.created_at)}"`,
        `"${(r?.location_name || e.report_id).replace(/"/g, '""')}"`,
        `"${(e.actor_name || 'System Operator').replace(/"/g, '""')}"`,
        `"${roleLabel(e.actor_role)}"`,
        `"${e.status}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `campus-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. ANALYTICS & OVERVIEW VIEW
  if (view === 'analytics') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Analytics &amp; Operational Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Campus-wide maintenance performance, resolution benchmarks, and signal metrics.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportSystemCSV}
            className="self-start sm:self-auto gap-2 px-4 py-2 h-9.5 text-xs font-medium rounded-lg shadow-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Download className="h-4 w-4" />
            Export System CSV
          </Button>
        </div>

        {/* Primary KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            label="Total Reports"
            value={stats.total}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4 text-status-open" />}
            label="Open Tickets"
            value={stats.open}
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-status-progress" />}
            label="In Progress"
            value={stats.inProgress}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-status-resolved" />}
            label="Resolved"
            value={stats.resolved}
          />
        </div>

        {/* Operational Performance Benchmarks */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Resolution Rate</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-foreground">
                {stats.resolutionRate}%
              </span>
              <span className="text-xs text-muted-foreground">of submitted issues</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${stats.resolutionRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Average Turnaround</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-foreground">
                {stats.avgResolutionDays}
              </span>
              <span className="text-xs text-muted-foreground">days per resolved ticket</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Measured from initial student submission to technician resolution.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Avg Signal Score</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-foreground">
                {stats.avgScore}
              </span>
              <span className="text-xs text-muted-foreground">points / ticket</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Boosted by peer corroborations and official Hall Rep verifications.
            </p>
          </div>
        </div>

        {/* Breakdown by Category & Signal Confidence */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Category Distribution */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Issue Breakdown by Category
              </h3>
            </div>
            <div className="space-y-3">
              {(Object.keys(categoryStats) as Category[]).map((cat) => {
                const count = categoryStats[cat];
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-foreground">{categoryLabel(cat)}</span>
                      <span className="text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verification Signal Distribution */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Verification Signal Distribution
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Confidence ranking helps facilities prioritize high-trust work orders with urgent community impact.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">High Verification (15+ pts)</p>
                    <p className="text-[11px] text-muted-foreground">Multi-confirmed or Rep verified</p>
                  </div>
                  <span className="font-heading text-lg font-bold text-foreground">
                    {signalHealth.high}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Moderate Signal (5-14 pts)</p>
                    <p className="text-[11px] text-muted-foreground">Peer corroborated reports</p>
                  </div>
                  <span className="font-heading text-lg font-bold text-foreground">
                    {signalHealth.medium}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Initial Submission (&lt;5 pts)</p>
                    <p className="text-[11px] text-muted-foreground">Single-reporter new tickets</p>
                  </div>
                  <span className="font-heading text-lg font-bold text-foreground">
                    {signalHealth.low}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Admin Navigation Shortcuts */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <h3 className="font-heading text-base font-semibold text-foreground mb-1">
            Administrative Management Consoles
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Jump directly to dedicated sections of university administration.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => onNavigate?.('admin-users')}
              className="flex items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Users Directory</p>
                  <p className="text-xs text-muted-foreground">{users.length} accounts</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => onNavigate?.('admin-onboarding')}
              className="flex items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Staff Onboarding</p>
                  <p className="text-xs text-muted-foreground">{onboardedStaffList.length} staff members</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => onNavigate?.('admin-locations')}
              className="flex items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Campus Locations</p>
                  <p className="text-xs text-muted-foreground">{locations.length} buildings</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => onNavigate?.('admin-audit')}
              className="flex items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Audit Trail</p>
                  <p className="text-xs text-muted-foreground">{statusEvents.length} logged events</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User Management Actions
  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditDept(u.hall_or_dept);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      toast.error('Name and email cannot be empty.');
      return;
    }
    setIsSavingUser(true);
    try {
      await updateUserProfile(editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        hall_or_dept: editDept.trim(),
      });
      toast.success('User Profile Updated', {
        description: `Profile details for ${editName.trim()} saved.`,
      });
      setEditingUser(null);
    } catch (err: any) {
      toast.error('Update Failed', {
        description: err.message || 'Could not update user.',
      });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleOpenBanUser = (u: User) => {
    setBanningUser(u);
    setBanReasonInput('Violation of university community guidelines and reporting integrity.');
  };

  const handleConfirmBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningUser) return;
    setIsProcessingBan(true);
    try {
      await banUser(banningUser.id, banReasonInput.trim());
      toast.warning('Account Suspended', {
        description: `${banningUser.name} has been suspended. Access to portal blocked.`,
      });
      setBanningUser(null);
    } catch (err: any) {
      toast.error('Suspension Failed', {
        description: err.message || 'Could not suspend user.',
      });
    } finally {
      setIsProcessingBan(false);
    }
  };

  const handleUnbanUser = async (u: User) => {
    try {
      await unbanUser(u.id);
      toast.success('Account Reinstated', {
        description: `${u.name} has been reinstated and can access the portal again.`,
      });
    } catch (err: any) {
      toast.error('Action Failed', {
        description: err.message || 'Could not reinstate account.',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      await deleteUserProfile(deletingUser.id);
      toast.info('Account Deleted', {
        description: `User account ${deletingUser.name} was permanently removed.`,
      });
      setDeletingUser(null);
    } catch (err: any) {
      toast.error('Delete Failed', {
        description: err.message || 'Could not delete user account.',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleRoleChange = (targetUser: User, newRole: Role) => {
    if (targetUser.role === newRole) return;
    try {
      updateUserRole(targetUser.id, newRole);
      toast.success('Role Updated', {
        description:
          targetUser.id === currentUser?.id
            ? `Your role was updated to ${roleLabel(newRole)}.`
            : `${targetUser.name}'s role was updated to ${roleLabel(newRole)}.`,
      });
    } catch (err: any) {
      toast.error('Role Update Failed', {
        description: err?.message || 'Could not update user role.',
      });
    }
  };

  // Hall Rep Application Actions
  const handleApproveRepRequest = async (req: HallRepRequest) => {
    setIsProcessingRepAction(true);
    try {
      await reviewHallRepRequest(req.id, true);
      toast.success('Hall Representative Approved', {
        description: `${req.user_name} is now the appointed Hall Rep for ${req.hall}.`,
      });
    } catch (err: any) {
      toast.error('Approval Failed', {
        description: err.message || 'Could not approve request.',
      });
    } finally {
      setIsProcessingRepAction(false);
    }
  };

  const handleOpenDeclineRep = (req: HallRepRequest) => {
    setDecliningReq(req);
    setDeclineFeedback('');
  };

  const handleConfirmDeclineRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decliningReq) return;
    setIsProcessingRepAction(true);
    try {
      await reviewHallRepRequest(decliningReq.id, false, declineFeedback.trim());
      toast.info('Application Declined', {
        description: `Notification sent to ${decliningReq.user_name}.`,
      });
      setDecliningReq(null);
    } catch (err: any) {
      toast.error('Decline Failed', {
        description: err.message || 'Could not decline application.',
      });
    } finally {
      setIsProcessingRepAction(false);
    }
  };

  const handleOpenRevokeRep = (
    userId: string,
    name: string,
    requestId?: string,
    hall?: string
  ) => {
    setRevokingRepUser({ userId, name, requestId, hall });
    setRevokeReason('');
  };

  const handleConfirmRevokeRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingRepUser) return;
    setIsProcessingRepAction(true);
    try {
      await revokeHallRepStatus(
        revokingRepUser.userId,
        revokeReason.trim() || 'Appointment concluded by Administration.',
        revokingRepUser.requestId
      );
      toast.info('Hall Representative Status Revoked', {
        description: `${revokingRepUser.name} has been returned to Student role.`,
      });
      setRevokingRepUser(null);
      setRevokeReason('');
    } catch (err: any) {
      toast.error('Revocation Failed', {
        description: err.message || 'Could not revoke status.',
      });
    } finally {
      setIsProcessingRepAction(false);
    }
  };

  // Report Moderation Actions
  const handleOpenArchiveReport = (r: Report) => {
    setArchivingReport(r);
    setArchiveReasonInput('Duplicate report or inappropriate campus submission.');
  };

  const handleConfirmArchiveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivingReport) return;
    setIsProcessingArchive(true);
    try {
      await archiveReport(archivingReport.id, archiveReasonInput.trim());
      toast.warning('Report Archived', {
        description: `Ticket ${formatReportToken(archivingReport.id)} suspended and hidden from active feeds.`,
      });
      setArchivingReport(null);
    } catch (err: any) {
      toast.error('Archiving Failed', {
        description: err.message || 'Could not archive report.',
      });
    } finally {
      setIsProcessingArchive(false);
    }
  };

  const handleRestoreReport = async (reportId: string) => {
    setIsProcessingArchive(true);
    try {
      await restoreReport(reportId);
      toast.success('Report Restored', {
        description: `Ticket ${formatReportToken(reportId)} reinstated to active campus feed.`,
      });
    } catch (err: any) {
      toast.error('Restore Failed', {
        description: err.message || 'Could not restore report.',
      });
    } finally {
      setIsProcessingArchive(false);
    }
  };

  // 2. HALL REP APPLICATIONS & APPOINTMENTS VIEW
  if (view === 'rep-requests') {
    const pendingCount = (hallRepRequests || []).filter((r) => r.status === 'pending').length;
    const approvedCount = (hallRepRequests || []).filter((r) => r.status === 'approved').length;
    const revokedCount = (hallRepRequests || []).filter(isRevokedReq).length;
    const steppedDownCount = (hallRepRequests || []).filter(isSteppedDownReq).length;
    const rejectedCount = (hallRepRequests || []).filter(isDeclinedReq).length;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Hall Representative Applications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review student applications, verify residence credentials, and authorize Hall Representatives.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                {pendingCount} Pending Review
              </span>
            )}
          </div>
        </div>

        {/* Rep Requests Summary KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            icon={<FileText className="h-4 w-4 text-primary" />}
            label="Total Applications"
            value={(hallRepRequests || []).length}
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            label="Pending Review"
            value={pendingCount}
          />
          <StatCard
            icon={<ShieldCheck className="h-4 w-4 text-teal-600" />}
            label="Active Reps"
            value={approvedCount}
          />
          <StatCard
            icon={<ShieldAlert className="h-4 w-4 text-rose-600" />}
            label="Revoked"
            value={revokedCount}
          />
          <StatCard
            icon={<RotateCcw className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
            label="Stepped Down"
            value={steppedDownCount}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            label="Declined"
            value={rejectedCount}
          />
        </div>

        {/* Requests Table Card */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
          {/* Search & Filter bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search candidate name, email, or hall..."
                value={repReqSearch}
                onChange={(e) => setRepReqSearch(e.target.value)}
                className="h-9 pl-8 text-xs w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
              {(
                [
                  { id: 'all', label: 'All', count: (hallRepRequests || []).length },
                  { id: 'pending', label: 'Pending', count: pendingCount },
                  { id: 'approved', label: 'Active Reps', count: approvedCount },
                  { id: 'revoked', label: 'Revoked', count: revokedCount },
                  { id: 'stepped_down', label: 'Stepped Down', count: steppedDownCount },
                  { id: 'rejected', label: 'Declined', count: rejectedCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRepReqFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    repReqFilter === tab.id
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Candidate</TableHead>
                  <TableHead className="font-semibold">Target Hall &amp; Room</TableHead>
                  <TableHead className="font-semibold">Leadership Motivation</TableHead>
                  <TableHead className="font-semibold">Submission Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Review Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No Hall Representative applications found.
                    </TableCell>
                  </TableRow>
                ) : (
                  repReqPagination.paginatedItems.map((req) => (
                    <TableRow key={req.id} className="hover:bg-muted/20">
                      <TableCell>
                        <p className="font-medium text-sm text-foreground">{req.user_name}</p>
                        <p className="text-xs text-muted-foreground">{req.user_email}</p>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-foreground">{req.hall}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed" title={req.statement}>
                          {req.statement}
                        </p>
                        {req.rejection_reason && (
                          <p
                            className={`mt-1 text-[11px] italic ${
                              isRevokedReq(req)
                                ? 'text-rose-700 dark:text-rose-400'
                                : isSteppedDownReq(req)
                                ? 'text-slate-600 dark:text-slate-400'
                                : 'text-destructive/90'
                            }`}
                          >
                            {isRevokedReq(req)
                              ? 'Revocation Note: '
                              : isSteppedDownReq(req)
                              ? 'Resignation Note: '
                              : 'Decline Reason: '}
                            {req.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(req.created_at)}
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        ) : req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
                            <Check className="h-3 w-3" />
                            Active Rep
                          </span>
                        ) : isRevokedReq(req) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <ShieldAlert className="h-3 w-3" />
                            Revoked
                          </span>
                        ) : isSteppedDownReq(req) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <RotateCcw className="h-3 w-3" />
                            Stepped Down
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            <XCircle className="h-3 w-3" />
                            Declined
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessingRepAction}
                              onClick={() => handleApproveRepRequest(req)}
                              className="h-7 text-xs gap-1 border-teal-600/30 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessingRepAction}
                              onClick={() => handleOpenDeclineRep(req)}
                              className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/20"
                            >
                              <X className="h-3.5 w-3.5" />
                              Decline
                            </Button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessingRepAction}
                            onClick={() => handleOpenRevokeRep(req.user_id, req.user_name, req.id, req.hall)}
                            className="h-7 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50"
                          >
                            Revoke Appointment
                          </Button>
                        ) : isRevokedReq(req) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">Revoked</span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessingRepAction}
                              onClick={() => handleApproveRepRequest(req)}
                              className="h-7 text-[11px] gap-1 text-teal-700 hover:bg-teal-50 border-teal-300"
                              title="Reinstate Hall Representative"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Reinstate
                            </Button>
                          </div>
                        ) : isSteppedDownReq(req) ? (
                          <span className="text-xs text-muted-foreground italic font-medium">Resigned</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Declined</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={repReqPagination.currentPage}
            totalPages={repReqPagination.totalPages}
            totalItems={repReqPagination.totalItems}
            pageSize={repReqPagination.pageSize}
            onPageChange={repReqPagination.setCurrentPage}
            onPageSizeChange={repReqPagination.setPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemLabel="applications"
          />
        </div>

        {/* Decline Feedback Modal */}
        {decliningReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-start justify-between pb-2 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-heading text-base font-bold text-foreground">
                    Decline Representative Application
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Candidate: <span className="font-semibold text-foreground">{decliningReq.user_name}</span> ({decliningReq.hall})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDecliningReq(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmDeclineRep} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decline-notes" className="text-xs font-semibold">
                    Feedback Note for Candidate (Optional)
                  </Label>
                  <Textarea
                    id="decline-notes"
                    placeholder="Provide a constructive reason (e.g. hall representative quota reached, residence mismatch, etc.)..."
                    value={declineFeedback}
                    onChange={(e) => setDeclineFeedback(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDecliningReq(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={isProcessingRepAction}
                    className="text-xs"
                  >
                    Confirm Decline
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Revoke Appointment Confirmation Modal */}
        {revokingRepUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-start justify-between pb-2 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-heading text-base font-bold text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    Revoke Hall Representative Appointment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Representative: <span className="font-semibold text-foreground">{revokingRepUser.name}</span>
                    {revokingRepUser.hall && <span className="font-medium text-foreground/80"> ({revokingRepUser.hall})</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isProcessingRepAction) {
                      setRevokingRepUser(null);
                      setRevokeReason('');
                    }
                  }}
                  disabled={isProcessingRepAction}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1.5 text-xs text-foreground/90">
                <p className="font-medium text-destructive">
                  Appointment termination warning:
                </p>
                <p className="text-muted-foreground text-[11px]">
                  This will immediately revert <strong>{revokingRepUser.name}&apos;s</strong> account to Student access and conclude their tenure for {revokingRepUser.hall || 'the residence hall'}.
                </p>
              </div>

              <form onSubmit={handleConfirmRevokeRep} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="revoke-notes" className="text-xs font-semibold">
                    Revocation Reason or Administrative Note (Optional)
                  </Label>
                  <Textarea
                    id="revoke-notes"
                    placeholder="e.g. Completed hall tenure, SRC rotation, code of conduct re-assignment..."
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    rows={3}
                    className="text-xs"
                    disabled={isProcessingRepAction}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessingRepAction}
                    onClick={() => {
                      setRevokingRepUser(null);
                      setRevokeReason('');
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={isProcessingRepAction}
                    className="text-xs gap-1.5"
                  >
                    {isProcessingRepAction ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Confirm Revoke
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. USERS DIRECTORY & MODERATION VIEW
  if (view === 'users') {
    const activeCount = users.filter((u) => !u.is_banned).length;
    const suspendedCount = users.filter((u) => u.is_banned).length;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              User Directory &amp; Moderation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage accounts, edit profile affiliations, enforce suspensions, and delegate roles across the university.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {filteredUsers.length} of {users.length} accounts
            </span>
            {suspendedCount > 0 && (
              <span className="rounded-full bg-destructive/10 border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive">
                {suspendedCount} Suspended
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
          {/* User Search & Role Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or hall/department..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-9 pl-8 text-xs w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Filter Role:</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="rep">Hall Reps</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Administrators</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">User</TableHead>
                  <TableHead className="font-semibold">University Email</TableHead>
                  <TableHead className="font-semibold">Hall / Department</TableHead>
                  <TableHead className="font-semibold">Account Status</TableHead>
                  <TableHead className="font-semibold">Assigned Role</TableHead>
                  <TableHead className="text-right font-semibold">Moderation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      No accounts found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  usersPagination.paginatedItems.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-sm text-foreground">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.hall_or_dept}
                      </TableCell>
                      <TableCell>
                        {user.is_banned ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              <Ban className="h-3 w-3" />
                              Suspended
                            </span>
                            {user.ban_reason && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={user.ban_reason}>
                                {user.ban_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(v) => handleRoleChange(user, v as Role)}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="rep">Hall Rep</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditUser(user)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit User Information"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {user.is_banned ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnbanUser(user)}
                              className="h-7 text-xs px-2 gap-1 text-emerald-700 hover:bg-emerald-50 border-emerald-300 dark:border-emerald-800"
                              title="Reinstate Account"
                            >
                              <UserCheck className="h-3 w-3" />
                              Reinstate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenBanUser(user)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Suspend Account"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingUser(user)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={usersPagination.currentPage}
            totalPages={usersPagination.totalPages}
            totalItems={usersPagination.totalItems}
            pageSize={usersPagination.pageSize}
            onPageChange={usersPagination.setCurrentPage}
            onPageSizeChange={usersPagination.setPageSize}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="accounts"
          />
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-start justify-between pb-2 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-heading text-base font-bold text-foreground">
                    Edit User Profile
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Update directory records for this university member.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name" className="text-xs font-semibold">
                    Full Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-email" className="text-xs font-semibold">
                    University Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-dept" className="text-xs font-semibold">
                    Hall or Department
                  </Label>
                  <Input
                    id="edit-dept"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingUser}
                    className="text-xs"
                  >
                    {isSavingUser ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ban User Modal */}
        {banningUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-start justify-between pb-2 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-heading text-base font-bold text-destructive">
                    Suspend User Account
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Target: <span className="font-semibold text-foreground">{banningUser.name}</span> ({banningUser.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBanningUser(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmBan} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ban-reason" className="text-xs font-semibold">
                    Reason for Suspension
                  </Label>
                  <Textarea
                    id="ban-reason"
                    placeholder="Enter reason for account suspension..."
                    value={banReasonInput}
                    onChange={(e) => setBanReasonInput(e.target.value)}
                    rows={3}
                    className="text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This notice will be presented to the user when attempting to sign in.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBanningUser(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={isProcessingBan}
                    className="text-xs"
                  >
                    {isProcessingBan ? 'Suspending...' : 'Confirm Suspension'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="space-y-1">
                <h3 className="font-heading text-base font-bold text-foreground">
                  Confirm Account Deletion
                </h3>
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to permanently delete the profile for <span className="font-semibold text-foreground">{deletingUser.name}</span>? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingUser(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeletingUser}
                  onClick={handleConfirmDelete}
                  className="text-xs"
                >
                  {isDeletingUser ? 'Deleting...' : 'Delete Profile'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. REPORT MODERATION & ARCHIVING VIEW
  if (view === 'reports') {
    const totalReportsCount = (reports || []).length;
    const activeReportsCount = (reports || []).filter((r) => !r.is_archived).length;
    const archivedReportsCount = (reports || []).filter((r) => r.is_archived).length;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Report Moderation &amp; Archiving
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit reported issues, suspend spam or invalid reports, and restore archived incidents to the campus feed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {archivedReportsCount > 0 && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {archivedReportsCount} Archived / Suspended
              </span>
            )}
          </div>
        </div>

        {/* Report Moderation KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Layers className="h-4 w-4 text-primary" />}
            label="Total Submitted Reports"
            value={totalReportsCount}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            label="Active Campus Tickets"
            value={activeReportsCount}
          />
          <StatCard
            icon={<Archive className="h-4 w-4 text-amber-600" />}
            label="Suspended / Archived"
            value={archivedReportsCount}
          />
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
          {/* Search & Filter bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket code (#REP-001), reporter, or location..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="h-9 pl-8 text-xs w-full"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
              {(['all', 'active', 'archived'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setReportArchiveFilter(mode)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                    reportArchiveFilter === mode
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'archived' ? 'Suspended / Archived' : mode}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Ticket</TableHead>
                  <TableHead className="font-semibold">Location &amp; Facility</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Reporter</TableHead>
                  <TableHead className="font-semibold">Moderation Status</TableHead>
                  <TableHead className="font-semibold">Ticket Status</TableHead>
                  <TableHead className="text-right font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModerationReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No reports match the current filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportsPagination.paginatedItems.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {formatReportToken(r.id)}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {r.location_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {categoryLabel(r.category)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.student_name}
                      </TableCell>
                      <TableCell>
                        {r.is_archived ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                              <Archive className="h-3 w-3" />
                              Archived / Suspended
                            </span>
                            {r.archived_reason && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={r.archived_reason}>
                                Reason: {r.archived_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Active Feed
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.is_archived ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessingArchive}
                            onClick={() => handleRestoreReport(r.id)}
                            className="h-7 text-xs gap-1 text-emerald-700 hover:bg-emerald-50 border-emerald-300 dark:border-emerald-800"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessingArchive}
                            onClick={() => handleOpenArchiveReport(r)}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                          >
                            <Archive className="h-3 w-3" />
                            Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={reportsPagination.currentPage}
            totalPages={reportsPagination.totalPages}
            totalItems={reportsPagination.totalItems}
            pageSize={reportsPagination.pageSize}
            onPageChange={reportsPagination.setCurrentPage}
            onPageSizeChange={reportsPagination.setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemLabel="reports"
          />
        </div>

        {/* Archive Report Modal */}
        {archivingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-start justify-between pb-2 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-heading text-base font-bold text-destructive">
                    Archive / Suspend Incident Report
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket: <span className="font-semibold text-foreground">{formatReportToken(archivingReport.id)}</span> ({archivingReport.location_name})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArchivingReport(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmArchiveReport} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="archive-reason" className="text-xs font-semibold">
                    Reason for Archiving / Suspension
                  </Label>
                  <Textarea
                    id="archive-reason"
                    placeholder="Enter reason for suspending or archiving this report..."
                    value={archiveReasonInput}
                    onChange={(e) => setArchiveReasonInput(e.target.value)}
                    rows={3}
                    className="text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The report will be removed from the active Campus Feed and technician work queues. The submitting student will receive an in-app notice.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setArchivingReport(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={isProcessingArchive}
                    className="text-xs"
                  >
                    {isProcessingArchive ? 'Archiving...' : 'Archive Report'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. STAFF ONBOARDING VIEW
  if (view === 'onboarding') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Staff Onboarding &amp; Provisioning
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Directly provision maintenance personnel with temporary credentials and enforce mandatory password updates.
          </p>
        </div>

        {/* Provisioning Form Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-base font-semibold text-foreground">
                Onboard Maintenance Technician
              </h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Direct Provisioning
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Upon signing in with this temporary passkey, the staff member will be prompted with a prominent banner in their profile settings to set a permanent password.
          </p>

          <form onSubmit={handleOnboardSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name" className="text-xs">Full Name</Label>
              <Input
                id="staff-name"
                placeholder="e.g. Kofi Mensah"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-email" className="text-xs">University Staff Email</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="e.g. kmensah@staff.ug.edu.gh"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-dept" className="text-xs">Assigned Unit / Department</Label>
              <Select value={staffDept} onValueChange={setStaffDept}>
                <SelectTrigger id="staff-dept" className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plumbing & Pipe Services">Plumbing &amp; Pipe Services</SelectItem>
                  <SelectItem value="Electrical & Power Systems">Electrical &amp; Power Systems</SelectItem>
                  <SelectItem value="Carpentry & Structural Works">Carpentry &amp; Structural Works</SelectItem>
                  <SelectItem value="Sanitation & Campus Hygiene">Sanitation &amp; Campus Hygiene</SelectItem>
                  <SelectItem value="HVAC & Climate Control">HVAC &amp; Climate Control</SelectItem>
                  <SelectItem value="General Facilities Crew">General Facilities Crew</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="temp-passkey" className="text-xs">Temporary Passkey</Label>
                <button
                  type="button"
                  onClick={generateNewPasskey}
                  className="text-[11px] text-primary hover:underline"
                >
                  Regenerate
                </button>
              </div>
              <div className="relative">
                <Input
                  id="temp-passkey"
                  value={tempPasskey}
                  onChange={(e) => setTempPasskey(e.target.value)}
                  className="font-mono text-sm tracking-wider pr-10"
                  required
                />
                <Key className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="sm:col-span-2 pt-2 flex justify-end">
              <Button type="submit" size="sm" className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Complete Staff Provisioning
              </Button>
            </div>
          </form>
        </div>

        {/* Onboarded Staff Status Table */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <h3 className="font-heading text-base font-semibold text-foreground mb-1">
            Active &amp; Pending Maintenance Personnel ({onboardedStaffList.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Track passkey activation status and copy login details for newly provisioned personnel.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Technician</TableHead>
                  <TableHead className="font-semibold">Unit / Department</TableHead>
                  <TableHead className="font-semibold">Credentials Status</TableHead>
                  <TableHead className="text-right font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboardedStaffList.map((staff) => {
                  const isPending = staff.requiresPasswordChange;
                  return (
                    <TableRow key={staff.id} className="hover:bg-muted/20">
                      <TableCell>
                        <p className="font-medium text-sm text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.email}</p>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground/80">
                        {staff.hall_or_dept}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Temporary Passkey Active ({staff.tempPasskey || 'Issued'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <Check className="h-3 w-3" />
                            Permanent Password Activated
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyCredentials(staff.email, staff.tempPasskey)}
                          className="h-7 text-xs gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy Login
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  // 4. CAMPUS LOCATIONS VIEW
  if (view === 'locations') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Campus Locations &amp; Infrastructure
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure buildings, blocks, and residence halls available for maintenance ticket submissions.
          </p>
        </div>

        {/* Add Location Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              Add New Campus Location / Hall
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-loc" className="text-xs">Location Name / Facility</Label>
              <Input
                id="new-loc"
                placeholder="e.g. Jean Nelson Hall, Block C Room 12"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Building Type</Label>
              <Select
                value={newLocType}
                onValueChange={(v) => setNewLocType(v as BuildingType)}
              >
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residence">Residence Halls</SelectItem>
                  <SelectItem value="academic">Academic Blocks</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="library">Library</SelectItem>
                  <SelectItem value="sports">Sports Complex</SelectItem>
                  <SelectItem value="dining">Dining</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddLocation}
              disabled={newLocName.trim().length < 3}
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Location
            </Button>
          </div>
        </div>

        {/* Location Catalog */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold text-foreground">
              Registered Locations Catalog ({locations.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              Campus Infrastructure Registry
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locationsPagination.paginatedItems.map((loc) => {
              const ticketCount = reports.filter((r) => r.location_id === loc.id && !r.is_archived).length;
              return (
                <div
                  key={loc.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate" title={loc.name}>{loc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {buildingTypeLabel(loc.building_type)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-mono">
                          {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditLocation(loc)}
                      title="Edit Location"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingLocation(loc)}
                      title="Delete Location"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DataPagination
            currentPage={locationsPagination.currentPage}
            totalPages={locationsPagination.totalPages}
            totalItems={locationsPagination.totalItems}
            pageSize={locationsPagination.pageSize}
            onPageChange={locationsPagination.setCurrentPage}
            onPageSizeChange={locationsPagination.setPageSize}
            pageSizeOptions={[9, 18, 36]}
            itemLabel="locations"
          />
        </div>

        {/* Edit Location Modal */}
        {editingLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Edit Campus Location
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-loc-name" className="text-xs">Location Name</Label>
                  <Input
                    id="edit-loc-name"
                    value={editLocName}
                    onChange={(e) => setEditLocName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Building Type</Label>
                  <Select
                    value={editLocType}
                    onValueChange={(v) => setEditLocType(v as BuildingType)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residence">Residence Halls</SelectItem>
                      <SelectItem value="academic">Academic Blocks</SelectItem>
                      <SelectItem value="administrative">Administrative</SelectItem>
                      <SelectItem value="library">Library</SelectItem>
                      <SelectItem value="sports">Sports Complex</SelectItem>
                      <SelectItem value="dining">Dining</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingLocation(null)}
                  disabled={isSavingLoc}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveLocation}
                  disabled={!editLocName.trim() || isSavingLoc}
                >
                  {isSavingLoc ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Location Confirmation Dialog */}
        {deletingLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-scale-in">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Confirm Location Deletion
                </h3>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to delete <strong className="text-foreground">{deletingLocation.name}</strong> from the campus registry?
                </p>
                {(() => {
                  const linkedCount = reports.filter((r) => r.location_id === deletingLocation.id).length;
                  if (linkedCount > 0) {
                    return (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                        Notice: This location has <strong>{linkedCount}</strong> maintenance ticket(s) attached. Past tickets will retain their recorded facility name.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingLocation(null)}
                  disabled={isDeletingLoc}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteLocation}
                  disabled={isDeletingLoc}
                >
                  {isDeletingLoc ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Location'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. SYSTEM AUDIT TRAIL VIEW
  if (view === 'audit') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              System Audit Trail &amp; Accountability
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Immutable operational log capturing every ticket transition, maintenance note, and staff action with explicit user attribution.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportAuditCSV}
            className="self-start sm:self-auto gap-2 px-4 py-2 h-9.5 text-xs font-medium rounded-lg shadow-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Download className="h-4 w-4" />
            Export Audit Log (CSV)
          </Button>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search audit trail by ticket (#WO-001), actor, location, note..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="h-9 pl-8 text-xs w-full"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Timestamp</TableHead>
                  <TableHead className="font-semibold">Context / Ticket</TableHead>
                  <TableHead className="font-semibold">Changed By (User)</TableHead>
                  <TableHead className="font-semibold">Status Event</TableHead>
                  <TableHead className="font-semibold">Operational Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No audit entries matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditPagination.paginatedItems.map((event) => {
                    const r = reports.find((item) => item.id === event.report_id);
                    const actorName =
                      event.actor_name || (event.actor_role ? roleLabel(event.actor_role) : 'System Operator');

                    return (
                      <TableRow key={event.id} className="hover:bg-muted/20">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(event.created_at)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
                              {formatWorkOrderToken(event.report_id)}
                            </span>
                            <span className="truncate">{r?.location_name || event.report_id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {actorName}
                            </span>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                              {roleLabel(event.actor_role)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={event.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm">
                          {event.note}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={auditPagination.currentPage}
            totalPages={auditPagination.totalPages}
            totalItems={auditPagination.totalItems}
            pageSize={auditPagination.pageSize}
            onPageChange={auditPagination.setCurrentPage}
            onPageSizeChange={auditPagination.setPageSize}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="audit records"
          />
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
