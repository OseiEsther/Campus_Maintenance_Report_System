'use client';

import { useEffect } from 'react';
import {
  Bell,
  Users,
  ArrowRightCircle,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';
import { useData } from '@/lib/data-context';
import { EmptyState } from '@/components/shared/empty-states';
import { relativeTime } from '@/lib/format';
import { DataPagination, usePagination } from '@/components/shared/data-pagination';
import type { Notification } from '@/lib/types';

const iconMap = {
  corroboration: Users,
  status_change: ArrowRightCircle,
  rep_action: CheckCircle2,
  comment: MessageSquare,
  rep_request: ShieldCheck,
  admin_notice: AlertTriangle,
};

export function Notifications({
  onOpenReport,
}: {
  onOpenReport: (id: string) => void;
}) {
  const { getNotifications, markNotificationsRead, markNotificationAsRead, loading } = useData();
  const notifications = getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const pagination = usePagination(notifications, {
    pageSize: 8,
  });

  useEffect(() => {
    const timer = setTimeout(() => markNotificationsRead(), 1500);
    return () => clearTimeout(timer);
  }, [markNotificationsRead]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              Notifications &amp; Activity Log
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              ALERTS
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Activity stream tracking corroborations, status transitions, and technician dispatches.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markNotificationsRead()}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-border cursor-pointer shadow-2xs"
          >
            <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications yet"
          description="You will see updates here when someone corroborates your reports, changes their status, or leaves a comment."
        />
      ) : (
        <>
          <div className="space-y-2">
            {pagination.paginatedItems.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpenReport={onOpenReport}
                onMarkRead={markNotificationAsRead}
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
            pageSizeOptions={[8, 16, 32]}
            itemLabel="notifications"
          />
        </>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onOpenReport,
  onMarkRead,
}: {
  notification: Notification;
  onOpenReport: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const Icon = iconMap[notification.type] || Bell;
  const isSystemAlert =
    !notification.report_id || notification.report_id.startsWith('SYSTEM_');

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (!isSystemAlert) {
      onOpenReport(notification.report_id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs cursor-pointer ${
        notification.read
          ? 'border-border bg-card'
          : 'border-primary/30 bg-primary/5 shadow-2xs'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          notification.read
            ? 'bg-muted/40 text-muted-foreground border-border'
            : 'bg-primary/10 text-primary border-primary/20'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {notification.report_description}
        </p>
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {relativeTime(notification.created_at)}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-primary/20" />
      )}
    </button>
  );
}
