'use client';

import { useState, useEffect, useRef } from 'react';
import { DataProvider, useData } from '@/lib/data-context';
import { AppShell, type ScreenName } from '@/components/shared/app-shell';
import { AuthScreen } from '@/components/screens/auth-screen';
import { MyReports } from '@/components/screens/my-reports';
import { NewReport } from '@/components/screens/new-report';
import { ReportDetail } from '@/components/screens/report-detail';
import { CampusFeed } from '@/components/screens/campus-feed';
import { RepQueue } from '@/components/screens/rep-queue';
import { StaffDashboard } from '@/components/screens/staff-dashboard';
import { AdminPanel } from '@/components/screens/admin-panel';
import { Notifications } from '@/components/screens/notifications';
import { ProfileSettings } from '@/components/screens/profile-settings';
import type { Role } from '@/lib/types';

function getDefaultScreenForRole(role: Role): ScreenName {
  switch (role) {
    case 'staff':
      return 'staff-dashboard';
    case 'admin':
      return 'admin-analytics';
    case 'rep':
      return 'rep-queue';
    case 'student':
    default:
      return 'home';
  }
}

function isScreenAllowedForRole(s: ScreenName, role: Role): boolean {
  if (role === 'admin') return true;
  const adminScreens: ScreenName[] = [
    'admin-panel',
    'admin-analytics',
    'admin-rep-requests',
    'admin-users',
    'admin-reports',
    'admin-onboarding',
    'admin-locations',
    'admin-audit',
  ];
  if (adminScreens.includes(s)) return false;

  if (role === 'staff') {
    return ['staff-dashboard', 'feed', 'notifications', 'profile', 'report-detail'].includes(s);
  }
  if (role === 'rep') {
    return ['rep-queue', 'home', 'feed', 'new-report', 'report-detail', 'notifications', 'profile'].includes(s);
  }
  // student
  return ['home', 'feed', 'new-report', 'report-detail', 'notifications', 'profile'].includes(s);
}

function getInitialScreen(role: Role): { screen: ScreenName; reportId: string | null } {
  if (typeof window === 'undefined') {
    return { screen: getDefaultScreenForRole(role), reportId: null };
  }

  // 1. Check URL parameters (?screen=...&id=...)
  const params = new URLSearchParams(window.location.search);
  const urlScreen = params.get('screen') as ScreenName | null;
  const urlReportId = params.get('id');

  // 2. Check localStorage
  const localScreen = localStorage.getItem('campusfix_active_screen') as ScreenName | null;
  const localReportId = localStorage.getItem('campusfix_report_id');

  const candidateScreen = urlScreen || localScreen;
  const candidateReportId = urlReportId || localReportId;

  if (candidateScreen && isScreenAllowedForRole(candidateScreen, role)) {
    return {
      screen: candidateScreen,
      reportId: candidateScreen === 'report-detail' ? candidateReportId : null,
    };
  }

  return { screen: getDefaultScreenForRole(role), reportId: null };
}

function persistNavigation(s: ScreenName, rId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('campusfix_active_screen', s);
    if (s === 'report-detail' && rId) {
      localStorage.setItem('campusfix_report_id', rId);
      window.history.replaceState(null, '', `?screen=report-detail&id=${encodeURIComponent(rId)}`);
    } else {
      localStorage.removeItem('campusfix_report_id');
      window.history.replaceState(null, '', s === 'home' ? '/' : `?screen=${encodeURIComponent(s)}`);
    }
  } catch {
    // Ignore storage errors in restricted sandboxes
  }
}

function AppContent() {
  const { currentUser, login, logout, loading } = useData();
  const [authed, setAuthed] = useState(false);
  const [screen, setScreen] = useState<ScreenName>('home');
  const [reportId, setReportId] = useState<string | null>(null);
  const sessionInitializedRef = useRef(false);

  // Restore authenticated state & preserve active screen across reloads
  useEffect(() => {
    if (currentUser && currentUser.id !== 'guest' && !currentUser.is_banned) {
      setAuthed(true);
      if (!sessionInitializedRef.current) {
        sessionInitializedRef.current = true;
        const initial = getInitialScreen(currentUser.role);
        setScreen(initial.screen);
        setReportId(initial.reportId);
        persistNavigation(initial.screen, initial.reportId);
      }
    } else if (currentUser && currentUser.id === 'guest') {
      setAuthed(false);
      sessionInitializedRef.current = false;
    }
  }, [currentUser]);

  // Support browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      if (currentUser && currentUser.id !== 'guest') {
        const initial = getInitialScreen(currentUser.role);
        setScreen(initial.screen);
        setReportId(initial.reportId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  const handleLogin = async (
    email: string,
    password: string,
    name?: string,
    hall?: string,
    role?: import('@/lib/types').Role,
    isSignUp?: boolean
  ) => {
    const user = await login(email, password, name, hall, role, isSignUp);
    const targetScreen = getDefaultScreenForRole(user.role);
    setScreen(targetScreen);
    setReportId(null);
    persistNavigation(targetScreen, null);
    sessionInitializedRef.current = true;
    setAuthed(true);
  };

  const handleLogout = async () => {
    await logout();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('campusfix_active_screen');
        localStorage.removeItem('campusfix_report_id');
        window.history.replaceState(null, '', '/');
      } catch {
        // Ignore
      }
    }
    sessionInitializedRef.current = false;
    setAuthed(false);
    setScreen('home');
    setReportId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white font-mono font-bold dark:bg-zinc-100 dark:text-zinc-950 animate-pulse">
            CF
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Connecting to CampusFix...</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const handleNavigate = (s: ScreenName) => {
    setScreen(s);
    if (s !== 'report-detail') {
      setReportId(null);
      persistNavigation(s, null);
    } else {
      persistNavigation(s, reportId);
    }
  };

  const handleOpenReport = (id: string) => {
    setReportId(id);
    setScreen('report-detail');
    persistNavigation('report-detail', id);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <MyReports onNavigate={handleNavigate} onOpenReport={handleOpenReport} />
        );
      case 'new-report':
        return (
          <NewReport onNavigate={handleNavigate} onOpenReport={handleOpenReport} />
        );
      case 'report-detail':
        return reportId ? (
          <ReportDetail reportId={reportId} onNavigate={handleNavigate} />
        ) : (
          <MyReports onNavigate={handleNavigate} onOpenReport={handleOpenReport} />
        );
      case 'feed':
        return <CampusFeed onOpenReport={handleOpenReport} />;
      case 'rep-queue':
        return <RepQueue onOpenReport={handleOpenReport} />;
      case 'staff-dashboard':
        return <StaffDashboard onOpenReport={handleOpenReport} />;
      case 'admin-panel':
      case 'admin-analytics':
        return <AdminPanel view="analytics" onNavigate={handleNavigate} />;
      case 'admin-rep-requests':
        return <AdminPanel view="rep-requests" onNavigate={handleNavigate} />;
      case 'admin-users':
        return <AdminPanel view="users" onNavigate={handleNavigate} />;
      case 'admin-reports':
        return <AdminPanel view="reports" onNavigate={handleNavigate} />;
      case 'admin-onboarding':
        return <AdminPanel view="onboarding" onNavigate={handleNavigate} />;
      case 'admin-locations':
        return <AdminPanel view="locations" onNavigate={handleNavigate} />;
      case 'admin-audit':
        return <AdminPanel view="audit" onNavigate={handleNavigate} />;
      case 'notifications':
        return (
          <Notifications onOpenReport={handleOpenReport} />
        );
      case 'profile':
        return <ProfileSettings onLogout={handleLogout} />;
      default:
        return (
          <MyReports onNavigate={handleNavigate} onOpenReport={handleOpenReport} />
        );
    }
  };

  return (
    <AppShell
      currentScreen={screen}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {renderScreen()}
    </AppShell>
  );
}

export default function Home() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
