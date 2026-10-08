'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Plus,
  Check,
  CheckCircle2,
  Send,
  Wrench,
} from 'lucide-react';
import { useData } from '@/lib/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import { SignalMeter, VerificationBreakdown } from '@/components/shared/signal-meter';
import { CategoryIcon } from '@/components/shared/category-icon';
import { ReportDetailSkeleton } from '@/components/shared/loading-skeletons';
import { ErrorState } from '@/components/shared/empty-states';
import { cn } from '@/lib/utils';
import type { ReportPriority } from '@/lib/types';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  categoryLabel,
  formatDateTime,
  daysSince,
  relativeTime,
  roleLabel,
  formatWorkOrderToken,
} from '@/lib/format';
import type { ScreenName } from '@/components/shared/app-shell';

export function ReportDetail({
  reportId,
  onNavigate,
}: {
  reportId: string;
  onNavigate: (screen: ScreenName) => void;
}) {
  const {
    getReportById,
    getStatusEventsByReport,
    getCommentsByReport,
    getCorroborationsByReport,
    getVerificationSignals,
    hasCorroborated,
    hasRepConfirmed,
    corroborateReport,
    addComment,
    updateReportPriority,
    assignReportTechnician,
    currentUser,
    loading,
    error,
  } = useData();

  const [commentText, setCommentText] = useState('');
  const [corroborating, setCorroborating] = useState(false);
  const [techInput, setTechInput] = useState('');

  const report = getReportById(reportId);

  useEffect(() => {
    if (report?.assigned_to !== undefined) {
      setTechInput(report.assigned_to || '');
    }
  }, [report?.assigned_to]);

  if (loading) return <ReportDetailSkeleton />;
  if (error) return <ErrorState />;

  if (!report) {
    return (
      <ErrorState
        title="Report not found"
        description="This report may have been removed or the link is incorrect."
        onRetry={() => onNavigate('home')}
      />
    );
  }

  const events = getStatusEventsByReport(reportId);
  const comments = getCommentsByReport(reportId);
  const corroborations = getCorroborationsByReport(reportId);
  const signals = getVerificationSignals(reportId);
  const alreadyCorroborated = hasCorroborated(reportId);
  const isOwnReport = report.student_id === currentUser.id;
  const isRepVerified = hasRepConfirmed(reportId);
  const days = daysSince(report.created_at);

  const handleCorroborate = () => {
    if (isOwnReport || alreadyCorroborated) return;
    setCorroborating(true);
    setTimeout(() => {
      corroborateReport(reportId);
      setCorroborating(false);
    }, 300);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim().length < 2) return;
    addComment(reportId, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Incident Feed
      </button>

      {/* Header */}
      <div className="space-y-3 pb-2 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-border">
            {formatWorkOrderToken(report.id)}
          </span>
          <StatusBadge status={report.status} />
          <span
            className={cn(
              'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border tracking-wider',
              report.priority === 'urgent'
                ? 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400'
                : report.priority === 'high'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
                : report.priority === 'low'
                ? 'bg-zinc-500/10 text-zinc-600 border-zinc-500/30 dark:text-zinc-400'
                : 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400'
            )}
          >
            {report.priority || 'medium'} priority
          </span>
          <SignalMeter score={report.verification_score} size="md" showNumber />
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 rounded border border-border/80">
            <CategoryIcon category={report.category} className="h-3 w-3" />
            {categoryLabel(report.category)}
          </span>
          {isRepVerified && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified by Rep
            </span>
          )}
          {report.assigned_to && (
            <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
              Assigned: {report.assigned_to}
            </span>
          )}
        </div>
        <h1 className="text-lg font-semibold text-foreground leading-relaxed">
          {report.description}
        </h1>
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
              ? `Reported today (${relativeTime(report.created_at)})`
              : days === 1
              ? `Reported yesterday (${relativeTime(report.created_at)})`
              : `Reported ${days} days ago`}
          </span>
          <span className="text-[11px]">
            Logged by <strong className="font-medium text-foreground">{report.student_name}</strong>
          </span>
        </div>
      </div>

      {/* Photo */}
      {report.photo_url && (
        <img
          src={report.photo_url}
          alt="Report photo"
          className="h-56 w-full max-w-lg rounded-lg border border-border object-cover"
        />
      )}

      {/* Facilities Staff Work Order Triage */}
      {(currentUser.role === 'staff' || currentUser.role === 'admin') && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Facilities Work Order Management
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Priority Level
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
                Assigned Technician
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
      )}

      {/* Corroborate button */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {corroborations.length} {corroborations.length === 1 ? 'person has' : 'people have'} seen this too
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isOwnReport
              ? 'You submitted this report. Others experiencing this issue can corroborate below.'
              : alreadyCorroborated
              ? 'You have already corroborated this report'
              : 'Confirm this issue if you have experienced the same problem'}
          </p>
        </div>
        <Button
          onClick={handleCorroborate}
          disabled={isOwnReport || alreadyCorroborated || corroborating}
          variant={isOwnReport || alreadyCorroborated ? 'secondary' : 'default'}
          className="gap-2 px-4 py-2 h-9.5 text-xs font-medium rounded-lg shrink-0"
        >
          {isOwnReport ? (
            <>
              <Check className="h-4 w-4" />
              Your Report
            </>
          ) : alreadyCorroborated ? (
            <>
              <Check className="h-4 w-4" />
              Corroborated
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              I have seen this too
            </>
          )}
        </Button>
      </div>

      {/* Verification score breakdown */}
      <Accordion type="single" collapsible>
        <AccordionItem value="verification" className="border-border">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Verification score breakdown
              </span>
              <span className="text-xs text-muted-foreground">
                ({signals.length} signals)
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <VerificationBreakdown
              signals={signals}
              corroborations={corroborations}
              photoUrl={report.photo_url}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Status timeline */}
      <div className="space-y-4">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Status Timeline
        </h2>
        <div className="relative space-y-4 pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
          {events.map((event, i) => (
            <div key={event.id} className="relative">
              <div
                className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-card ${
                  i === events.length - 1
                    ? event.status === 'resolved'
                      ? 'bg-status-resolved'
                      : event.status === 'in_progress'
                        ? 'bg-status-progress'
                        : 'bg-status-open'
                    : 'bg-muted-foreground/40'
                }`}
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={event.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{event.note}</p>
                <p className="text-xs text-muted-foreground">
                  by {roleLabel(event.actor_role)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Comments ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to add context or an update.
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 rounded-lg border border-border bg-card p-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {comment.author_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {comment.author_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {roleLabel(comment.author_role)}
                    </span>
                    <span
                      className="text-xs text-muted-foreground"
                      title={formatDateTime(comment.created_at)}
                    >
                      {relativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <Textarea
            placeholder="Add a comment or update..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={commentText.trim().length < 2}
            className="h-auto self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
