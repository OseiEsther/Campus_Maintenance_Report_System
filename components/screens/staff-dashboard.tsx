'use client';

import { useState, useMemo } from 'react';
import {
  MapPin,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  StickyNote,
  Send,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { SignalMeter } from '@/components/shared/signal-meter';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { ErrorState } from '@/components/shared/empty-states';
import { categoryLabel, daysSince, formatDate, formatWorkOrderToken, matchTicketSearch } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';
import type { Report, ReportStatus, Category, ReportPriority } from '@/lib/types';

type SortField = 'score' | 'location' | 'category' | 'created' | 'status';
type SortDir = 'asc' | 'desc';

export function StaffDashboard({
  onOpenReport,
}: {
  onOpenReport: (id: string) => void;
}) {
  const { reports, loading, error, updateReportStatus, addInternalNote } =
    useData();
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Resolution Modal State
  const [resolvingReport, setResolvingReport] = useState<Report | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const filteredAndSorted = useMemo(() => {
    let result = reports.filter((r) => {
      if (r.is_archived) return false;
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLocation = r.location_name.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchStudent = r.student_name.toLowerCase().includes(q);
        const matchTicket = matchTicketSearch(r.id, searchQuery);
        if (!matchLocation && !matchDesc && !matchStudent && !matchTicket) return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'score':
          cmp = a.verification_score - b.verification_score;
          break;
        case 'location':
          cmp = a.location_name.localeCompare(b.location_name);
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'created':
          cmp =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [reports, searchQuery, categoryFilter, statusFilter, sortField, sortDir]);

  const pagination = usePagination(filteredAndSorted, {
    pageSize: 10,
    resetDeps: [searchQuery, categoryFilter, statusFilter, sortField, sortDir],
  });

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState />;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  const handleStatusChange = (reportId: string, newStatus: ReportStatus) => {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    if (newStatus === 'resolved') {
      // Open resolution note dialog
      setResolvingReport(report);
      setResolutionNote('');
      return;
    }

    const notes: Record<ReportStatus, string> = {
      open: 'Reopened for inspection',
      in_progress: 'Dispatched to facilities maintenance crew',
      resolved: 'Marked as Resolved',
    };
    updateReportStatus(reportId, newStatus, notes[newStatus]);
  };

  const confirmResolution = () => {
    if (!resolvingReport) return;
    const note = resolutionNote.trim() || 'Work completed and verified by maintenance staff';
    updateReportStatus(resolvingReport.id, 'resolved', note);
    setResolvingReport(null);
    setResolutionNote('');
  };

  const exportCSV = () => {
    const headers = [
      'Ticket ID',
      'Location',
      'Category',
      'Verification Score',
      'Status',
      'Date Reported',
      'Reporter',
      'Description',
    ];
    const rows = filteredAndSorted.map((r) => [
      `"${r.id}"`,
      `"${r.location_name.replace(/"/g, '""')}"`,
      `"${r.category}"`,
      r.verification_score,
      `"${r.status}"`,
      `"${r.created_at}"`,
      `"${r.student_name.replace(/"/g, '""')}"`,
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
      `campus-work-orders-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: reports.length,
    open: reports.filter((r) => r.status === 'open').length,
    inProgress: reports.filter((r) => r.status === 'in_progress').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Maintenance Operations
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              DISPATCH
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Triage reported incidents, dispatch technicians, and log repair progress across campus.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={exportCSV}
            className="gap-2 px-4 py-2 h-9.5 text-xs font-medium rounded-lg shadow-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Download className="h-4 w-4" />
            Export Work Orders (CSV)
          </Button>
        </div>
      </div>

      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-zinc-300 transition-colors">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Total Queue</span>
            <span className="font-mono text-[10px] text-zinc-400">ALL</span>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-foreground">
            {stats.total}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total campus tickets logged</p>
        </div>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.03] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-900">
            <span>Needs Attention</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-amber-950">
            {stats.open}
          </p>
          <p className="mt-1 text-[11px] text-amber-800/80">Pending technician inspection</p>
        </div>

        <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.03] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-blue-900">
            <span>In Progress</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20 animate-pulse" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-blue-950">
            {stats.inProgress}
          </p>
          <p className="mt-1 text-[11px] text-blue-800/80">Active work crew deployed</p>
        </div>

        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.03] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-emerald-900">
            <span>Resolved</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-emerald-950">
            {stats.resolved}
          </p>
          <p className="mt-1 text-[11px] text-emerald-800/80">Verified completed work</p>
        </div>
      </div>

      {/* Segmented Filter & Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented status selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              statusFilter === 'all'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All <span className="font-mono text-[10px] ml-1 text-muted-foreground">{stats.total}</span>
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              statusFilter === 'open'
                ? 'bg-card text-amber-900 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Open <span className="font-mono text-[10px] ml-1 text-muted-foreground">{stats.open}</span>
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              statusFilter === 'in_progress'
                ? 'bg-card text-blue-900 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            In Progress <span className="font-mono text-[10px] ml-1 text-muted-foreground">{stats.inProgress}</span>
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              statusFilter === 'resolved'
                ? 'bg-card text-emerald-900 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Resolved <span className="font-mono text-[10px] ml-1 text-muted-foreground">{stats.resolved}</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ticket (#WO-001), location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 text-xs w-full bg-card"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="plumbing">Plumbing</SelectItem>
              <SelectItem value="structural">Structural</SelectItem>
              <SelectItem value="sanitation">Sanitation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <Table className="min-w-[940px]">
          <TableHeader>
            <TableRow className="bg-muted/40 border-b border-border">
              <TableHead className="w-[28%] min-w-[240px]">
                <button
                  onClick={() => handleSort('location')}
                  className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Work Order &amp; Location <SortIcon field="location" />
                </button>
              </TableHead>
              <TableHead className="w-[14%] min-w-[120px]">
                <button
                  onClick={() => handleSort('category')}
                  className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Category <SortIcon field="category" />
                </button>
              </TableHead>
              <TableHead className="w-[14%] min-w-[120px]">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Status <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead className="w-[16%] min-w-[140px]">
                <button
                  onClick={() => handleSort('score')}
                  className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Telemetry Score <SortIcon field="score" />
                </button>
              </TableHead>
              <TableHead className="w-[12%] min-w-[110px]">
                <button
                  onClick={() => handleSort('created')}
                  className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Reported <SortIcon field="created" />
                </button>
              </TableHead>
              <TableHead className="w-[16%] min-w-[160px] text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Triage Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No maintenance reports matching the current filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((report) => (
                <StaffReportRow
                  key={report.id}
                  report={report}
                  onOpenReport={onOpenReport}
                  onStatusChange={handleStatusChange}
                  expanded={expandedId === report.id}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === report.id ? null : report.id)
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
        pageSizeOptions={[5, 10, 25]}
        itemLabel="work orders"
      />

      {/* Resolution Note Modal */}
      {resolvingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-status-resolved" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Resolve Maintenance Order
                </h3>
              </div>
              <button
                onClick={() => setResolvingReport(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-semibold text-foreground">
                  {resolvingReport.location_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Issue Description</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {resolvingReport.description}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Resolution Summary / Work Done Note
                </label>
                <Textarea
                  placeholder="Describe repair actions taken (e.g., Replaced valve, tested pressure, cleaned drain)..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  This note will be visible to the reporter on their report tracking timeline.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolvingReport(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmResolution}
                className="bg-status-resolved hover:bg-status-resolved/90 text-white"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Confirm &amp; Mark Resolved
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffReportRow({
  report,
  onOpenReport,
  onStatusChange,
  expanded,
  onToggleExpand,
}: {
  report: Report;
  onOpenReport: (id: string) => void;
  onStatusChange: (reportId: string, status: ReportStatus) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const {
    getInternalNotesByReport,
    addInternalNote,
    updateInternalNote,
    deleteInternalNote,
    updateReportPriority,
    assignReportTechnician,
  } = useData();

  const notes = getInternalNotesByReport(report.id);
  const [draftNote, setDraftNote] = useState('');
  const [techInput, setTechInput] = useState(report.assigned_to || '');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftNote.trim().length < 3) return;
    addInternalNote(report.id, draftNote.trim());
    setDraftNote('');
    toast.success('Internal Note Saved', {
      description: `Note added to work order for ${report.location_name}`,
    });
  };

  const startEdit = (id: string, currentText: string) => {
    setEditingNoteId(id);
    setEditText(currentText);
  };

  const handleSaveEdit = (noteId: string) => {
    if (editText.trim().length < 2) return;
    updateInternalNote(noteId, editText.trim());
    setEditingNoteId(null);
    setEditText('');
    toast.success('Internal Note Updated');
  };

  const handleDelete = (noteId: string) => {
    deleteInternalNote(noteId);
    toast.info('Internal Note Removed');
  };

  return (
    <>
      <TableRow className="hover:bg-muted/30 transition-colors border-b border-border/80">
        <TableCell className="w-[26%] min-w-[220px] max-w-[260px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-border shrink-0">
                {formatWorkOrderToken(report.id)}
              </span>
              <button
                onClick={() => onOpenReport(report.id)}
                className="truncate text-left text-xs font-medium text-foreground hover:text-primary transition-colors"
                title={report.location_name}
              >
                {report.location_name}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1 pl-0.5">
              {report.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span
                className={cn(
                  'text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border tracking-wider',
                  report.priority === 'urgent'
                    ? 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400'
                    : report.priority === 'high'
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
                    : report.priority === 'low'
                    ? 'bg-zinc-500/10 text-zinc-600 border-zinc-500/30 dark:text-zinc-400'
                    : 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400'
                )}
              >
                {report.priority || 'medium'}
              </span>
              {report.assigned_to && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Tech: {report.assigned_to}
                </span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="w-[14%] min-w-[120px] text-xs capitalize text-muted-foreground whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0" />
            {categoryLabel(report.category)}
          </span>
        </TableCell>
        <TableCell className="w-[14%] min-w-[120px] whitespace-nowrap">
          <StatusBadge status={report.status} />
        </TableCell>
        <TableCell className="w-[16%] min-w-[140px] whitespace-nowrap">
          <SignalMeter score={report.verification_score} showNumber />
        </TableCell>
        <TableCell className="w-[12%] min-w-[110px] text-xs text-muted-foreground whitespace-nowrap">
          <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
            <Clock className="h-3 w-3 text-zinc-400" />
            {formatDate(report.created_at)}
          </span>
        </TableCell>
        <TableCell className="w-[18%] min-w-[180px] text-right">
          <div className="flex items-center justify-end gap-2">
            <Select
              value={report.status}
              onValueChange={(v) => onStatusChange(report.id, v as ReportStatus)}
            >
              <SelectTrigger className="h-7 w-[118px] text-[11px] font-medium border-border/80 bg-background shadow-xs hover:border-zinc-400 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-open" />
                    Open
                  </span>
                </SelectItem>
                <SelectItem value="in_progress" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-progress" />
                    In Progress
                  </span>
                </SelectItem>
                <SelectItem value="resolved" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-resolved" />
                    Resolved
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className={`relative h-7 w-7 transition-colors ${
                notes.length > 0
                  ? 'text-primary bg-primary/10 border-primary/30 hover:bg-primary/20'
                  : 'text-muted-foreground border-border/80 hover:bg-accent hover:text-foreground'
              } ${expanded ? 'ring-2 ring-primary/40' : ''}`}
              onClick={onToggleExpand}
              title={`Internal technician notes (${notes.length})`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              {notes.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-xs">
                  {notes.length}
                </span>
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20 p-4 border-y border-border/80">
            <div className="space-y-4 max-w-3xl">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Internal Facilities Notes &bull; {report.location_name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({notes.length} {notes.length === 1 ? 'note' : 'notes'})
                  </span>
                </div>
                <button
                  onClick={onToggleExpand}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Close
                </button>
              </div>

              {/* Work Order Dispatch & Triage Controls */}
              <div className="rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Work Order Dispatch &amp; Triage
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Token: {formatWorkOrderToken(report.id)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Triage Priority Level
                    </label>
                    <Select
                      value={report.priority || 'medium'}
                      onValueChange={(val) => updateReportPriority(report.id, val as ReportPriority)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Assigned Field Technician
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Kwesi Mensah"
                        value={techInput}
                        onChange={(e) => setTechInput(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        onClick={() => assignReportTechnician(report.id, techInput.trim() || null)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Existing notes list */}
              {notes.length > 0 ? (
                <div className="space-y-2.5">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {note.author_name}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium text-muted-foreground">
                            {note.author_role}
                          </span>
                          <span className="text-muted-foreground">
                            &bull; {formatDate(note.created_at)}
                          </span>
                          {note.updated_at && (
                            <span className="italic text-[10px] text-muted-foreground">
                              (edited)
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        {editingNoteId !== note.id && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(note.id, note.text)}
                              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                              title="Edit note"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(note.id)}
                              className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content or Inline Edit */}
                      {editingNoteId === note.id ? (
                        <div className="space-y-2 pt-1">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="text-xs bg-muted/30"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={() => handleSaveEdit(note.id)}
                              disabled={editText.trim().length < 2}
                            >
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {note.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    No internal notes yet for this work order. Use the form below to record technician assignments, spare part needs, or crew updates.
                  </p>
                </div>
              )}

              {/* Add new note form */}
              <form onSubmit={handleSaveDraft} className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Add New Internal Note
                </label>
                <Textarea
                  placeholder="Record technician assignment, required parts (e.g. 1/2-inch valve), dispatch notes..."
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={2}
                  className="text-xs bg-card"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={draftNote.trim().length < 3}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Save Internal Note
                  </Button>
                </div>
              </form>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
