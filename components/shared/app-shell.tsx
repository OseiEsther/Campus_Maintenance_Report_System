'use client';

import { useState, type ReactNode } from 'react';
import {
  Home,
  FilePlus,
  LayoutGrid,
  Bell,
  User as UserIcon,
  ClipboardCheck,
  BarChart3,
  Menu,
  ShieldCheck,
  LogOut,
  Users,
  UserPlus,
  MapPin,
  History,
  Search,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/lib/data-context';
import { roleLabel } from '@/lib/format';
import type { Role } from '@/lib/types';

export type ScreenName =
  | 'home'
  | 'new-report'
  | 'feed'
  | 'notifications'
  | 'profile'
  | 'rep-queue'
  | 'staff-dashboard'
  | 'admin-panel'
  | 'admin-analytics'
  | 'admin-rep-requests'
  | 'admin-users'
  | 'admin-reports'
  | 'admin-onboarding'
  | 'admin-locations'
  | 'admin-audit'
  | 'report-detail';

interface NavItem {
  id: ScreenName;
  label: string;
  icon: typeof Home;
}

function getRoleNavItems(role: Role): NavItem[] {
  switch (role) {
    case 'staff':
      return [
        { id: 'staff-dashboard', label: 'Work Orders', icon: BarChart3 },
        { id: 'feed', label: 'Campus Feed', icon: LayoutGrid },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'profile', label: 'Profile', icon: UserIcon },
      ];
    case 'admin':
      return [
        { id: 'admin-analytics', label: 'Analytics & Overview', icon: BarChart3 },
        { id: 'admin-rep-requests', label: 'Hall Rep Requests', icon: ShieldCheck },
        { id: 'admin-users', label: 'Users & Moderation', icon: Users },
        { id: 'admin-reports', label: 'Report Moderation', icon: Archive },
        { id: 'admin-onboarding', label: 'Staff Onboarding', icon: UserPlus },
        { id: 'admin-locations', label: 'Campus Locations', icon: MapPin },
        { id: 'admin-audit', label: 'System Audit Trail', icon: History },
        { id: 'feed', label: 'Campus Feed', icon: LayoutGrid },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'profile', label: 'Profile', icon: UserIcon },
      ];
    case 'rep':
      return [
        { id: 'rep-queue', label: 'Rep Queue', icon: ClipboardCheck },
        { id: 'feed', label: 'Campus Feed', icon: LayoutGrid },
        { id: 'home', label: 'My Reports', icon: Home },
        { id: 'new-report', label: 'Submit Issue', icon: FilePlus },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'profile', label: 'Profile', icon: UserIcon },
      ];
    case 'student':
    default:
      return [
        { id: 'home', label: 'My Reports', icon: Home },
        { id: 'new-report', label: 'Report Issue', icon: FilePlus },
        { id: 'feed', label: 'Campus Feed', icon: LayoutGrid },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'profile', label: 'Profile', icon: UserIcon },
      ];
  }
}

const roleBadgeStyles: Record<Role, string> = {
  student: 'bg-zinc-100 text-zinc-700 border-zinc-200/90',
  rep: 'bg-teal-500/10 text-teal-800 border-teal-500/25',
  staff: 'bg-blue-500/10 text-blue-800 border-blue-500/25',
  admin: 'bg-purple-500/10 text-purple-800 border-purple-500/25',
};

export function AppShell({
  currentScreen,
  onNavigate,
  onLogout,
  children,
}: {
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const {
    currentUser,
    getUnreadNotificationCount,
    hallRepRequests,
    logout,
  } = useData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = getUnreadNotificationCount();
  const pendingRepRequestsCount = (hallRepRequests || []).filter(
    (r) => r.status === 'pending'
  ).length;

  const handleSignOut = async () => {
    await logout();
    if (onLogout) {
      onLogout();
    }
  };

  const visibleNavItems = getRoleNavItems(currentUser.role);
  // For mobile bottom bar, select the primary 4 items
  const mobileNavItems =
    currentUser.role === 'admin'
      ? [
          { id: 'admin-analytics' as ScreenName, label: 'Analytics', icon: BarChart3 },
          { id: 'admin-rep-requests' as ScreenName, label: 'Rep Requests', icon: ShieldCheck },
          { id: 'admin-users' as ScreenName, label: 'Users', icon: Users },
          { id: 'admin-reports' as ScreenName, label: 'Reports', icon: Archive },
        ]
      : visibleNavItems.slice(0, 4);

  const handleNav = (screen: ScreenName) => {
    onNavigate(screen);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/70 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 font-mono text-xs font-bold shadow-xs border border-zinc-700">
              CF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  CampusFix
                </span>
                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono font-medium text-muted-foreground border border-border">
                  ops
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">University Operations</p>
            </div>
          </div>
        </div>

        {/* Live status operational bar */}
        <div className="mx-3 mt-3 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            Maintenance Crew on Duty
          </span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">UG-CAMPUS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/75">
            {currentUser.role === 'admin'
              ? 'Administration & Governance'
              : currentUser.role === 'staff'
              ? 'Maintenance Operations'
              : currentUser.role === 'rep'
              ? 'Hall Representation'
              : 'Student Services'}
          </div>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            const isNotification = item.id === 'notifications';
            const isRepRequests = item.id === 'admin-rep-requests';

            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'group flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-all',
                  active
                    ? 'bg-zinc-900 text-zinc-50 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active
                        ? 'text-zinc-50'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {item.label}
                </span>
                {isNotification && unreadCount > 0 && (
                  <span
                    className={cn(
                      'flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-mono font-bold',
                      active
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-900 text-zinc-50'
                    )}
                  >
                    {unreadCount}
                  </span>
                )}
                {isRepRequests && pendingRepRequestsCount > 0 && (
                  <span
                    className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-mono font-bold bg-amber-500 text-white"
                  >
                    {pendingRepRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Sign Out */}
        <div className="border-t border-border/80 p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 font-mono text-xs font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {currentUser.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.2 text-[10px] font-medium rounded border',
                      roleBadgeStyles[currentUser.role]
                    )}
                  >
                    {roleLabel(currentUser.role)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border/80 bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 font-mono text-xs font-bold">
                CF
              </div>
              <span className="text-sm font-semibold text-foreground">
                CampusFix
              </span>
            </div>

            {/* Desktop header context breadcrumb */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-[11px] text-muted-foreground">UG Facilities</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-medium text-foreground">
                {currentUser.hall_or_dept}
              </span>
              <span className="text-muted-foreground/40">/</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded text-[10px] font-semibold border',
                  roleBadgeStyles[currentUser.role]
                )}
              >
                {roleLabel(currentUser.role)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 ring-2 ring-emerald-500/20" />
              System Online
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => onNavigate('notifications')}
              className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-mono font-bold text-zinc-50 border border-card">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 bg-card shadow-lg animate-slide-up flex flex-col">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/70">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 font-mono text-xs font-bold border border-zinc-700">
                  CF
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      CampusFix
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono font-medium text-muted-foreground border border-border">
                      ops
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {roleLabel(currentUser.role)} View
                  </p>
                </div>
              </div>

              <nav className="space-y-1 px-3 py-4 flex-1 overflow-y-auto">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentScreen === item.id;
                  const isNotification = item.id === 'notifications';
                  const isRepRequests = item.id === 'admin-rep-requests';

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium',
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        {item.label}
                      </span>
                      {isNotification && unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-mono font-bold text-primary-foreground">
                          {unreadCount}
                        </span>
                      )}
                      {isRepRequests && pendingRepRequestsCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-mono font-bold text-white">
                          {pendingRepRequestsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-border p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(currentUser.role)}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Temporary Passkey Active Notification Banner */}
        {currentUser.requiresPasswordChange && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 shrink-0">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Temporary Passkey Active: Administrator requires you to set your permanent password.
            </span>
            <button
              onClick={() => onNavigate('profile')}
              className="underline font-bold text-amber-950 hover:text-amber-800 shrink-0"
            >
              Update in Settings &rarr;
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card lg:hidden shadow-sm">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              currentScreen === item.id ||
              (currentScreen === 'report-detail' && item.id === 'home');
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
                  active ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
