'use client';

import { useState, useMemo } from 'react';
import { FileText, Plus, MapPin, Clock, Search } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { StatusBadge } from '@/components/shared/status-badge';
import { SignalMeter } from '@/components/shared/signal-meter';
import { CategoryIcon } from '@/components/shared/category-icon';
import { EmptyState } from '@/components/shared/empty-states';
import { ReportListSkeleton } from '@/components/shared/loading-skeletons';
import { ErrorState } from '@/components/shared/empty-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  categoryLabel,
  daysSince,
  formatReportToken,
  matchTicketSearch,
  relativeTime,
  formatDateTime,
} from '@/lib/format';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';
import type { ScreenName } from '@/components/shared/app-shell';
import type { Report } from '@/lib/types';

export function MyReports({
  onNavigate,
  onOpenReport,
}: {
  onNavigate: (screen: ScreenName) => void;
  onOpenReport: (id: string) => void;
}) {
  const { currentUser, reports, loading, error } = useData();
  const [search, setSearch] = useState('');

  const allMyReports = useMemo(() => {
    return reports
      .filter((r) => r.student_id === currentUser.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, currentUser.id]);

  const filteredReports = useMemo(() => {
    if (!search.trim()) return allMyReports;
    const q = search.toLowerCase();
    return allMyReports.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.location_name.toLowerCase().includes(q) ||
        matchTicketSearch(r.id, search)
    );
  }, [allMyReports, search]);

  const pagination = usePagination(filteredReports, {
    pageSize: 10,
    resetDeps: [search],
  });

  if (loading) return <ReportListSkeleton />;

  if (error) return <ErrorState />;

  if (allMyReports.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              My Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track issues you have reported
            </p>
          </div>
        </div>
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No reports yet"
          description="You have not submitted any maintenance reports. When you report an issue, it will appear here with its current status and verification score."
          action={
            <Button onClick={() => onNavigate('new-report')}>
              <Plus className="mr-2 h-4 w-4" />
              Report an Issue
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              My Reported Incidents
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              STUDENT LOG
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track verification progress, corroboration signals, and repair status for your submitted issues.
          </p>
        </div>
        <Button
          onClick={() => onNavigate('new-report')}
          className="gap-2 self-start sm:self-auto h-9.5 px-4 text-xs font-medium rounded-lg shadow-xs hover:shadow transition-all"
        >
          <Plus className="h-4 w-4" />
          Report New Issue
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search your reports by ticket (#REP-001), description, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9.5 text-xs bg-card"
        />
      </div>

      {filteredReports.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No matching reports found"
          description="Try searching with a different ticket code, keyword, or location."
        />
      ) : (
        <>
          <div className="space-y-3">
            {pagination.paginatedItems.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onClick={() => onOpenReport(report.id)}
              />
            ))}
          </div>

          <DataPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemLabel="reports"
          />
        </>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onClick,
}: {
  report: Report;
  onClick: () => void;
}) {
  const days = daysSince(report.created_at);

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:border-zinc-400 hover:shadow-xs dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-border">
              {formatReportToken(report.id)}
            </span>
            <StatusBadge status={report.status} />
            <SignalMeter score={report.verification_score} showNumber />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 rounded border border-border/80">
              <CategoryIcon category={report.category} className="h-3 w-3" />
              {categoryLabel(report.category)}
            </span>
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
              {days === 0
                ? `Submitted today (${relativeTime(report.created_at)})`
                : days === 1
                ? `Submitted yesterday (${relativeTime(report.created_at)})`
                : `${days} days active`}
            </span>
          </div>
        </div>
        {report.photo_url && (
          <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
            <img
              src={report.photo_url}
              alt=""
              className="h-14 w-14 object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
      </div>
    </button>
  );
}
