'use client';

import { useState, useMemo } from 'react';
import {
  List,
  Map as MapIcon,
  MapPin,
  Clock,
  Filter,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { useData } from '@/lib/data-context';
import { StatusBadge } from '@/components/shared/status-badge';
import { SignalMeter } from '@/components/shared/signal-meter';
import { CategoryIcon } from '@/components/shared/category-icon';
import { CampusVectorMap } from '@/components/shared/campus-vector-map';
import { FeedSkeleton } from '@/components/shared/loading-skeletons';
import { ErrorState, EmptyState } from '@/components/shared/empty-states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  categoryLabel,
  daysSince,
  formatReportToken,
  matchTicketSearch,
  relativeTime,
  formatDateTime,
} from '@/lib/format';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';
import type { Report, Category, ReportStatus } from '@/lib/types';

type SortOption = 'score' | 'newest' | 'oldest';

export function CampusFeed({
  onOpenReport,
}: {
  onOpenReport: (id: string) => void;
}) {
  const { reports, locations, loading, error } = useData();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = reports.filter((r) => !r.is_archived);

    if (statusFilter !== 'all')
      result = result.filter((r) => r.status === statusFilter);
    if (categoryFilter !== 'all')
      result = result.filter((r) => r.category === categoryFilter);
    if (locationFilter !== 'all')
      result = result.filter((r) => r.location_id === locationFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.location_name.toLowerCase().includes(q) ||
          r.student_name.toLowerCase().includes(q) ||
          matchTicketSearch(r.id, search)
      );
    }

    if (sortBy === 'score')
      result.sort((a, b) => b.verification_score - a.verification_score);
    else if (sortBy === 'newest')
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    else
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    return result;
  }, [reports, statusFilter, categoryFilter, locationFilter, sortBy, search]);

  const pagination = usePagination(filtered, {
    pageSize: 10,
    resetDeps: [statusFilter, categoryFilter, locationFilter, sortBy, search],
  });

  if (loading) return <FeedSkeleton />;
  if (error) return <ErrorState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Campus Incident Feed
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              PUBLIC LOG
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live maintenance work orders, verified incident reports, and interactive campus blueprint.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 shadow-2xs">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
                view === 'list'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" />
              List View
            </button>
            <button
              onClick={() => setView('map')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
                view === 'map'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Interactive Map
            </button>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums px-2 py-1 rounded bg-muted/30 border border-border">
            {filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ticket code (#REP-001), description, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9.5 text-xs bg-card"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ReportStatus | 'all')}
          >
            <SelectTrigger className="w-auto min-w-[120px]">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as Category | 'all')}
          >
            <SelectTrigger className="w-auto min-w-[120px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="plumbing">Plumbing</SelectItem>
              <SelectItem value="structural">Structural</SelectItem>
              <SelectItem value="sanitation">Sanitation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={locationFilter}
            onValueChange={setLocationFilter}
          >
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="w-auto min-w-[140px]">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Highest score</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {view === 'list' ? (
        filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No reports match your filters"
            description="Try adjusting the filters or search terms. There may be no reports for the combination you selected."
          />
        ) : (
          <>
            <div className="space-y-3">
              {pagination.paginatedItems.map((report) => (
                <FeedReportCard
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
        )
      ) : (
        <CampusVectorMap
          reports={reports.filter((r) => !r.is_archived)}
          locations={locations}
          onOpenReport={onOpenReport}
        />
      )}
    </div>
  );
}

function FeedReportCard({
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
                ? relativeTime(report.created_at)
                : days === 1
                ? 'Yesterday'
                : `${days}d ago`}
            </span>
            <span className="text-[11px]">
              Reported by <strong className="font-medium text-foreground">{report.student_name}</strong>
            </span>
          </div>
        </div>
        {report.photo_url && (
          <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
            <img
              src={report.photo_url}
              alt=""
              className="h-16 w-16 object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
      </div>
    </button>
  );
}
