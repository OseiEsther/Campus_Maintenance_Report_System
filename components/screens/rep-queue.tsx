'use client';

import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Building,
  Globe,
  BadgeCheck,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SignalMeter } from '@/components/shared/signal-meter';
import { CategoryIcon } from '@/components/shared/category-icon';
import { EmptyState } from '@/components/shared/empty-states';
import { ReportListSkeleton } from '@/components/shared/loading-skeletons';
import { ErrorState } from '@/components/shared/empty-states';
import {
  categoryLabel,
  daysSince,
  formatReportToken,
  matchTicketSearch,
  relativeTime,
  formatDateTime,
} from '@/lib/format';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';
import type { Report } from '@/lib/types';

export function RepQueue({
  onOpenReport,
}: {
  onOpenReport: (id: string) => void;
}) {
  const {
    reports,
    currentUser,
    loading,
    error,
    confirmReport,
    disputeReport,
    hasRepConfirmed,
    hasRepDisputed,
  } = useData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [scope, setScope] = useState<'my_hall' | 'all'>('my_hall');
  const [reviewTab, setReviewTab] = useState<'pending' | 'reviewed' | 'all'>('pending');
  const [search, setSearch] = useState('');

  // Rep's assigned hall (e.g. "Pentagon Hall", "Republic Hall")
  const repHall = useMemo(() => {
    return (currentUser.hall_or_dept || '').trim().toLowerCase();
  }, [currentUser.hall_or_dept]);

  const queue = useMemo(() => {
    let openReports = reports
      .filter((r) => r.status === 'open' && !r.is_archived)
      .sort((a, b) => b.verification_score - a.verification_score);

    if (scope === 'my_hall') {
      openReports = openReports.filter((r) => {
        const reportHall = (r.hall || '').trim().toLowerCase();
        return reportHall === repHall;
      });
    }

    if (reviewTab === 'pending') {
      openReports = openReports.filter((r) => !hasRepConfirmed(r.id) && !hasRepDisputed(r.id));
    } else if (reviewTab === 'reviewed') {
      openReports = openReports.filter((r) => hasRepConfirmed(r.id) || hasRepDisputed(r.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      openReports = openReports.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.location_name.toLowerCase().includes(q) ||
          r.student_name.toLowerCase().includes(q) ||
          matchTicketSearch(r.id, search)
      );
    }

    return openReports;
  }, [reports, scope, repHall, reviewTab, search, hasRepConfirmed, hasRepDisputed]);

  const pagination = usePagination(queue, {
    pageSize: 6,
    resetDeps: [search, scope, reviewTab],
  });

  if (loading) return <ReportListSkeleton />;
  if (error) return <ErrorState />;

  const handleConfirm = (reportId: string, locationName: string) => {
    if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) return;
    confirmReport(reportId);
    toast.success('Report Verified', {
      description: `Official Hall Rep verification recorded for ${locationName}. Single-use confirmation locked.`,
    });
  };

  const handleDispute = (reportId: string, locationName: string) => {
    if (disputeReason.trim().length < 5) return;
    if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) return;
    disputeReport(reportId, disputeReason.trim());
    setDisputingId(null);
    setDisputeReason('');
    setExpandedId(null);
    toast.info('Official Dispute Filed', {
      description: `Dispute filed for ${locationName}. Score adjusted and facilities notified.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Hall Rep Verification Queue
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              FIELD TRIAGE
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Verify student reports in your jurisdiction to grant official verification signals. Single-use verification locked.
          </p>
        </div>

        {/* Scope Switcher */}
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 self-start sm:self-auto shadow-2xs">
          <button
            onClick={() => setScope('my_hall')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
              scope === 'my_hall'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            {currentUser.hall_or_dept}
          </button>
          <button
            onClick={() => setScope('all')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
              scope === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            All Campus
          </button>
        </div>
      </div>

      {/* Review Status Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setReviewTab('pending')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            reviewTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending Verification
        </button>
        <button
          onClick={() => setReviewTab('reviewed')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            reviewTab === 'reviewed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Reviewed by Rep
        </button>
        <button
          onClick={() => setReviewTab('all')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            reviewTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All Open Reports
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search queue by ticket (#REP-001), description, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9.5 text-xs bg-card"
        />
      </div>


      {queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title={
            reviewTab === 'pending'
              ? 'No reports awaiting verification'
              : reviewTab === 'reviewed'
              ? 'No reviewed reports yet'
              : 'No open reports found'
          }
          description={
            reviewTab === 'pending'
              ? 'Your queue is currently clear! When students submit reports in your hall, they will appear here for field verification.'
              : 'Reports you confirm or dispute will be listed here with their status.'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
          {pagination.paginatedItems.map((report) => {
            const isConfirmed = hasRepConfirmed(report.id);
            const isDisputed = hasRepDisputed(report.id);
            const hasActed = isConfirmed || isDisputed;

            return (
              <div
                key={report.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => onOpenReport(report.id)}
                    className="flex-1 min-w-0 space-y-2 text-left group"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-border shrink-0">
                        {formatReportToken(report.id)}
                      </span>
                      <SignalMeter score={report.verification_score} showNumber />
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 rounded border border-border/80">
                        <CategoryIcon category={report.category} className="h-3 w-3" />
                        {categoryLabel(report.category)}
                      </span>

                      {/* Rep Verification Status Badges */}
                      {isConfirmed && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified by Rep
                        </span>
                      )}
                      {isDisputed && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold border border-rose-200 dark:border-rose-800/60">
                          <XCircle className="h-3.5 w-3.5" />
                          Disputed by Hall Rep
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-normal text-zinc-800 dark:text-zinc-200 leading-relaxed group-hover:text-primary transition-colors line-clamp-2">
                      {report.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                        <MapPin className="h-3 w-3 text-zinc-400" />
                        {report.location_name}
                      </span>
                      <span
                        className="flex items-center gap-1 font-mono text-[11px] tabular-nums"
                        title={formatDateTime(report.created_at)}
                      >
                        <Clock className="h-3 w-3 text-zinc-400" />
                        {daysSince(report.created_at) === 0
                          ? relativeTime(report.created_at)
                          : daysSince(report.created_at) === 1
                          ? 'Yesterday'
                          : `${daysSince(report.created_at)}d ago`}
                      </span>
                      <span className="text-[11px]">Reported by <strong className="font-medium text-foreground">{report.student_name}</strong></span>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === report.id ? null : report.id)
                    }
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                    title="Toggle action panel"
                  >
                    {expandedId === report.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {expandedId === report.id && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    {hasActed ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-2">
                          {isConfirmed ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-status-resolved" />
                              <span className="text-xs font-medium text-foreground">
                                You have verified this report. Rep confirmation is single-use and locked.
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-destructive" />
                              <span className="text-xs font-medium text-foreground">
                                This report was marked as disputed by a Hall Rep.
                              </span>
                            </>
                          )}
                        </div>
                        <Button
                          disabled
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 shrink-0"
                        >
                          {isConfirmed ? 'Verified by Rep' : 'Disputed'}
                        </Button>
                      </div>
                    ) : disputingId === report.id ? (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground">
                          Reason for disputing this report
                        </label>
                        <Textarea
                          placeholder="Provide details (e.g. inspected room and issue is already resolved, duplicate ticket, or wrong location)..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDisputingId(null);
                              setDisputeReason('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDispute(report.id, report.location_name)}
                            disabled={disputeReason.trim().length < 5}
                          >
                            Submit Official Dispute
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Confirming marks this report as verified and alerts facilities maintenance staff. Each report can only be confirmed once.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisputingId(report.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <XCircle className="mr-1.5 h-4 w-4" />
                            Dispute Report
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleConfirm(report.id, report.location_name)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Confirm &amp; Verify
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DataPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[6, 12, 24]}
          itemLabel="reports"
        />
      </>
    )}
  </div>
);
}
