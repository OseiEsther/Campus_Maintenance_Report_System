// INVARIANT: All screens (Staff Dashboard, My Reports, Campus Feed, Rep Queue,
// Notifications, Admin Panel, Settings) read from and write to this single shared DataContext.
// Status changes, internal notes, and rep actions sync directly to Supabase with
// Realtime subscriptions so all screens update live from one Postgres database.
// This context operates strictly with live database data and Supabase Auth.
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { toast } from 'sonner';
import { MAX_VERIFICATION_SCORE } from './types';
import type {
  User,
  Location,
  CampusUnit,
  CampusUnitCategory,
  Report,
  ReportPriority,
  Corroboration,
  StatusEvent,
  Comment,
  VerificationSignal,
  InternalNote,
  Notification,
  ReportStatus,
  Role,
  BuildingType,
  HallRepRequest,
  HallRepRequestStatus,
  DataContextValue,
} from './types';
import { mockCampusUnits } from './fixtures';
import { supabase } from './supabase';
import { roleLabel } from './format';

const DEFAULT_USER: User = {
  id: 'guest',
  name: 'Campus User',
  email: 'user@st.university.edu.gh',
  hall_or_dept: 'Campus General',
  role: 'student',
};

function dbProfileToUser(p: any): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    hall_or_dept: p.hall_or_dept,
    role: p.role as Role,
    requiresPasswordChange: p.requires_password_change ?? false,
    onboardedAt: p.onboarded_at ?? undefined,
    is_banned: p.is_banned ?? false,
    ban_reason: p.ban_reason ?? undefined,
  };
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const currentUserRef = useRef<User>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [campusUnits, setCampusUnits] = useState<CampusUnit[]>(mockCampusUnits);
  const [corroborations, setCorroborations] = useState<Corroboration[]>([]);
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [verificationSignals, setVerificationSignals] = useState<VerificationSignal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hallRepRequests, setHallRepRequests] = useState<HallRepRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reusable data loader: fetches all live Postgres tables
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    try {
      const fetchAllWithTimeout = async () => {
        const fetchPromise = Promise.all([
          supabase.from('reports').select('*').order('created_at', { ascending: false }),
          supabase.from('locations').select('*').order('name'),
          supabase.from('profiles').select('*'),
          supabase.from('corroborations').select('*'),
          supabase.from('status_events').select('*').order('created_at', { ascending: false }),
          supabase.from('comments').select('*').order('created_at', { ascending: true }),
          supabase.from('internal_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('verification_signals').select('*'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('hall_rep_requests').select('*').order('created_at', { ascending: false }),
          supabase.from('campus_units').select('*').order('name'),
        ]);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Network request timed out')), 8000)
        );

        return Promise.race([fetchPromise, timeoutPromise]);
      };

      const [
        reportsRes,
        locationsRes,
        profilesRes,
        corroborationsRes,
        statusEventsRes,
        commentsRes,
        internalNotesRes,
        signalsRes,
        notificationsRes,
        repRequestsRes,
        campusUnitsRes,
      ] = await fetchAllWithTimeout();

      // Verify that database tables exist
      if (reportsRes.error || locationsRes.error || profilesRes.error) {
        const errMsg = reportsRes.error?.message || locationsRes.error?.message || profilesRes.error?.message;
        console.warn('Supabase tables not initialized or query failed:', errMsg);
        setError('Database tables not initialized. Please run supabase/schema.sql in your Supabase SQL Editor.');
        return;
      }

      // Populate state purely from database rows
      const loadedUsers = (profilesRes.data || []).map(dbProfileToUser);
      setUsers(loadedUsers);

      // Restore real session strictly from Supabase Auth with timeout protection
      let sessionData: any = null;
      try {
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 3000)
        );
        sessionData = await Promise.race([sessionPromise, sessionTimeout]);
      } catch (e) {
        console.warn('Failed to retrieve session:', e);
        sessionData = { data: { session: null } };
      }

      const authUser = sessionData?.data?.session?.user || sessionData?.session?.user;

      if (authUser) {
        let matched = loadedUsers.find((u) => u.id === authUser.id);
        if (!matched) {
          try {
            const { data: p } = await Promise.race([
              supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
              new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
            ]);
            if (p) matched = dbProfileToUser(p);
          } catch (e) {
            console.warn('Profile fetch timed out or failed:', e);
          }
        }

        if (matched) {
          if (!matched.is_banned) {
            setCurrentUser(matched);
          } else {
            await supabase.auth.signOut().catch(() => {});
            setCurrentUser(DEFAULT_USER);
          }
        }
      }

      const dbLocations = (locationsRes.data || []) as Location[];
      const dbUnits = (campusUnitsRes.data || []) as CampusUnit[];

      if (dbUnits.length > 0) {
        setCampusUnits(dbUnits);
      }

      if (dbLocations.length > 0) {
        setLocations(dbLocations);
      } else if (dbUnits.length > 0) {
        const mappedLocs: Location[] = dbUnits.map((u) => ({
          id: u.id,
          name: u.name,
          hall: u.name,
          building_type: u.category === 'hall' ? 'residence' : u.category === 'department' ? 'academic' : 'administrative',
          created_at: u.created_at || new Date().toISOString(),
        }));
        setLocations(mappedLocs);
      }
      setReports((reportsRes.data || []) as Report[]);
      setCorroborations((corroborationsRes.data || []) as Corroboration[]);
      setStatusEvents((statusEventsRes.data || []) as StatusEvent[]);
      setComments((commentsRes.data || []) as Comment[]);
      setInternalNotes((internalNotesRes.data || []) as InternalNote[]);
      setVerificationSignals((signalsRes.data || []) as VerificationSignal[]);
      setHallRepRequests(
        ((repRequestsRes.data || []) as any[]).map((r) => {
          const reason = (r.rejection_reason || r.admin_notes || '').toLowerCase();
          const isConcluded =
            r.status === 'stepped_down' ||
            (r.status === 'rejected' &&
              (reason.includes('stepped down') ||
                reason.includes('revok') ||
                reason.includes('resigned') ||
                reason.includes('concluded')));
          return {
            ...r,
            status: isConcluded ? 'stepped_down' : r.status,
            user_id: r.user_id || r.student_id || '',
            user_name: r.user_name || r.student_name || 'Candidate',
            user_email: r.user_email || r.student_email || '',
            hall: r.hall || r.hall_name || '',
            student_id: r.student_id || r.user_id || '',
            student_name: r.student_name || r.user_name || 'Candidate',
            student_email: r.student_email || r.user_email || '',
            hall_name: r.hall_name || r.hall || '',
            rejection_reason: r.rejection_reason || r.admin_notes,
            admin_notes: r.admin_notes || r.rejection_reason,
          };
        })
      );
      setNotifications((notificationsRes.data || []) as Notification[]);
    } catch (err) {
      console.warn('Supabase connection error:', err);
      setError('Could not connect to Supabase. Please check your internet connection or project status.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Initial Load: Fetch live data and restore real Supabase Auth session
  useEffect(() => {
    let isMounted = true;
    loadData(true);

    // Listen to Supabase Auth state changes without locking
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setCurrentUser(DEFAULT_USER);
      } else if (session?.user) {
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const { data: p } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            if (p && isMounted) {
              const u = dbProfileToUser(p);
              if (u.is_banned) {
                await supabase.auth.signOut().catch(() => {});
                setCurrentUser(DEFAULT_USER);
              } else {
                const wasDifferentUser = currentUserRef.current.id !== u.id;
                setCurrentUser(u);
                if (wasDifferentUser) {
                  await loadData(false);
                }
              }
            }
          } catch (e) {
            console.warn('Profile sync notice:', e);
          }
        }, 0);
      }
    });

    // 2. Realtime Subscriptions for live Postgres synchronization
    const channel = supabase
      .channel('campusfix-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Report;
            setReports((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Report;
            setReports((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setReports((prev) => prev.filter((r) => r.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corroborations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Corroboration;
            setCorroborations((prev) => {
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as StatusEvent;
            setStatusEvents((prev) => {
              if (prev.some((e) => e.id === row.id)) return prev;
              return [row, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Comment;
            setComments((prev) => {
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_notes' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as InternalNote;
            setInternalNotes((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as InternalNote;
            setInternalNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setInternalNotes((prev) => prev.filter((n) => n.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verification_signals' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as VerificationSignal;
            setVerificationSignals((prev) => {
              if (prev.some((s) => s.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Notification;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            setNotifications((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setNotifications((prev) => prev.filter((n) => n.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Location;
            setLocations((prev) => {
              if (prev.some((l) => l.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campus_units' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as CampusUnit;
            setCampusUnits((prev) => {
              if (prev.some((u) => u.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CampusUnit;
            setCampusUnits((prev) =>
              prev
                .map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setCampusUnits((prev) => prev.filter((u) => u.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const user = dbProfileToUser(payload.new);
            setUsers((prev) => {
              const idx = prev.findIndex((u) => u.id === user.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = user;
                return next;
              }
              return [...prev, user];
            });

            // If active user was banned by admin, automatically terminate session
            if (user.id === currentUserRef.current.id && user.is_banned) {
              supabase.auth.signOut().catch(() => {});
              setCurrentUser(DEFAULT_USER);
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setUsers((prev) => prev.filter((u) => u.id !== oldId));
            if (oldId === currentUserRef.current.id) {
              supabase.auth.signOut().catch(() => {});
              setCurrentUser(DEFAULT_USER);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hall_rep_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as HallRepRequest;
            setHallRepRequests((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as HallRepRequest;
            setHallRepRequests((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setHallRepRequests((prev) => prev.filter((r) => r.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const getReportById = useCallback(
    (id: string) => reports.find((r) => r.id === id),
    [reports]
  );

  const getStatusEventsByReport = useCallback(
    (reportId: string) =>
      statusEvents
        .filter((e) => e.report_id === reportId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [statusEvents]
  );

  const getCommentsByReport = useCallback(
    (reportId: string) =>
      comments
        .filter((c) => c.report_id === reportId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments]
  );

  const getCorroborationsByReport = useCallback(
    (reportId: string) => corroborations.filter((c) => c.report_id === reportId),
    [corroborations]
  );

  const getVerificationSignals = useCallback(
    (reportId: string) => verificationSignals.filter((s) => s.report_id === reportId),
    [verificationSignals]
  );

  const getNotifications = useCallback(
    () => notifications.filter((n) => !n.user_id || n.user_id === currentUser.id),
    [notifications, currentUser.id]
  );

  const getUnreadNotificationCount = useCallback(
    () =>
      notifications.filter(
        (n) => (!n.user_id || n.user_id === currentUser.id) && !n.read
      ).length,
    [notifications, currentUser.id]
  );

  const hasCorroborated = useCallback(
    (reportId: string) =>
      corroborations.some(
        (c) => c.report_id === reportId && c.student_id === currentUser.id
      ),
    [corroborations, currentUser.id]
  );

  const hasRepConfirmed = useCallback(
    (reportId: string) =>
      verificationSignals.some(
        (s) => s.report_id === reportId && s.label.toLowerCase().includes('rep')
      ),
    [verificationSignals]
  );

  const hasRepDisputed = useCallback(
    (reportId: string) =>
      statusEvents.some(
        (se) => se.report_id === reportId && se.note.toLowerCase().includes('disputed by')
      ),
    [statusEvents]
  );

  const addReport: DataContextValue['addReport'] = useCallback(
    async (input) => {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();

      const descLength = input.description.trim().length;
      let initialScore = 1;
      if (descLength >= 100) initialScore += 3;
      if (input.photo_url) initialScore += 2;

      const initialSignals: VerificationSignal[] = [
        {
          id: crypto.randomUUID(),
          report_id: newId,
          label: '+1 report submitted',
          points: 1,
        },
      ];

      if (descLength >= 100) {
        initialSignals.push({
          id: crypto.randomUUID(),
          report_id: newId,
          label: '+3 detailed description (over 100 characters)',
          points: 3,
        });
      }

      if (input.photo_url) {
        initialSignals.push({
          id: crypto.randomUUID(),
          report_id: newId,
          label: '+2 photo attached',
          points: 2,
        });
      }

      const newReport: Report = {
        id: newId,
        student_id: currentUser.id,
        student_name: currentUser.name,
        location_id: input.location_id,
        location_name: input.location_name,
        hall: input.hall,
        category: input.category,
        description: input.description.trim(),
        photo_url: input.photo_url || null,
        status: 'open',
        priority: input.priority || 'medium',
        verification_score: Math.min(MAX_VERIFICATION_SCORE, initialScore),
        is_archived: false,
        created_at: now,
      };

      const newEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: newId,
        status: 'open',
        note: `Report submitted by ${currentUser.name}`,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      setReports((prev) => [newReport, ...prev]);
      setStatusEvents((prev) => [newEvent, ...prev]);
      setVerificationSignals((prev) => [...initialSignals, ...prev]);

      try {
        const { error: repErr } = await supabase.from('reports').insert({
          id: newReport.id,
          student_id: newReport.student_id,
          student_name: newReport.student_name,
          location_id: newReport.location_id,
          location_name: newReport.location_name,
          hall: newReport.hall || null,
          category: newReport.category,
          description: newReport.description,
          photo_url: newReport.photo_url,
          status: 'open',
          priority: newReport.priority,
        });
        if (repErr) {
          console.error('Supabase error inserting report:', repErr);
          // Roll back optimistic updates
          setReports((prev) => prev.filter((r) => r.id !== newReport.id));
          setStatusEvents((prev) => prev.filter((e) => e.id !== newEvent.id));
          setVerificationSignals((prev) => prev.filter((s) => s.report_id !== newReport.id));
          toast.error('Failed to save report to server', { description: repErr.message });
          throw new Error(repErr.message);
        }

        const { error: eventErr } = await supabase.from('status_events').insert(newEvent);
        if (eventErr) {
          console.error('Supabase error inserting status event:', eventErr);
          toast.warning('Report saved, but audit event logging failed', { description: eventErr.message });
        }
      } catch (err: any) {
        console.error('Error in addReport persist:', err);
        // Roll back optimistic updates
        setReports((prev) => prev.filter((r) => r.id !== newReport.id));
        setStatusEvents((prev) => prev.filter((e) => e.id !== newEvent.id));
        setVerificationSignals((prev) => prev.filter((s) => s.report_id !== newReport.id));
        toast.error('Network Error', { description: err.message || 'Could not save report' });
        throw err;
      }

      return newReport;
    },
    [currentUser]
  );

  const corroborateReport = useCallback(
    async (reportId: string) => {
      const report = reports.find((r) => r.id === reportId);
      if (!report) return;
      if (report.status === 'resolved' || report.is_archived) {
        toast.error('Action Not Permitted', {
          description: 'Cannot corroborate a resolved or archived report.',
        });
        return;
      }
      if (report.student_id === currentUser.id) {
        toast.error('Action Not Permitted', { description: 'You cannot corroborate your own report.' });
        return;
      }
      if (hasCorroborated(reportId)) {
        toast.info('Already Corroborated', { description: 'You have already corroborated this report.' });
        return;
      }

      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newCorroboration: Corroboration = {
        id: newId,
        report_id: reportId,
        student_id: currentUser.id,
        student_name: currentUser.name,
        created_at: now,
      };

      const newScore = Math.min(MAX_VERIFICATION_SCORE, report.verification_score + 2);

      // Optimistic update
      setCorroborations((prev) => [...prev, newCorroboration]);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, verification_score: newScore } : r))
      );

      try {
        const { error } = await supabase.from('corroborations').insert({
          id: newCorroboration.id,
          report_id: newCorroboration.report_id,
          student_id: newCorroboration.student_id,
          student_name: newCorroboration.student_name,
        });

        if (error) {
          toast.error('Corroboration Failed', { description: error.message });
          setCorroborations((prev) => prev.filter((c) => c.id !== newId));
          setReports((prev) =>
            prev.map((r) => (r.id === reportId ? { ...r, verification_score: report.verification_score } : r))
          );
        } else {
          toast.success('Report Corroborated', { description: '+2 verification score added.' });
        }
      } catch (err: any) {
        console.warn('Supabase persist error for corroborateReport:', err);
        toast.error('Network Error', { description: err.message || 'Could not corroborate' });
      }
    },
    [currentUser, hasCorroborated, reports]
  );

  const updateReportStatus = useCallback(
    async (reportId: string, newStatus: ReportStatus, note: string) => {
      const now = new Date().toISOString();
      const newEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: newStatus,
        note,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      setStatusEvents((prev) => [...prev, newEvent]);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );

      const report = reports.find((r) => r.id === reportId);
      let newNotification: Notification | null = null;
      if (report) {
        newNotification = {
          id: crypto.randomUUID(),
          user_id: report.student_id,
          type: 'status_change',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
          message: `Your report status changed to ${newStatus.replace('_', ' ')}: ${note}`,
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [newNotification!, ...prev]);
      }

      try {
        const { error: repErr } = await supabase
          .from('reports')
          .update({ status: newStatus })
          .eq('id', reportId);
        if (repErr) {
          toast.error('Failed to update status', { description: repErr.message });
          return;
        }

        await supabase.from('status_events').insert(newEvent);
        toast.success('Report Status Updated', { description: `Status changed to ${newStatus.replace('_', ' ')}.` });
      } catch (err: any) {
        console.warn('Supabase persist notice for updateReportStatus:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, reports]
  );

  const updateReportPriority = useCallback(
    async (reportId: string, priority: ReportPriority) => {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, priority } : r))
      );

      const now = new Date().toISOString();
      const auditEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: reports.find((r) => r.id === reportId)?.status || 'open',
        note: `Work order priority adjusted to ${priority.toUpperCase()} by ${currentUser.name}`,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        const { error } = await supabase
          .from('reports')
          .update({ priority })
          .eq('id', reportId);
        if (error) {
          toast.error('Failed to update priority', { description: error.message });
        } else {
          await supabase.from('status_events').insert(auditEvent);
          toast.success('Priority Updated', { description: `Report priority set to ${priority}.` });
        }
      } catch (err: any) {
        console.warn('Supabase persist error for updateReportPriority:', err);
        toast.error('Network Error', { description: err.message || 'Could not reach server' });
      }
    },
    [currentUser, reports]
  );

  const assignReportTechnician = useCallback(
    async (reportId: string, technicianName: string | null) => {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, assigned_to: technicianName } : r))
      );

      const now = new Date().toISOString();
      const noteText = technicianName
        ? `Assigned technician: ${technicianName} by ${currentUser.name}`
        : `Technician unassigned by ${currentUser.name}`;

      const auditEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: reports.find((r) => r.id === reportId)?.status || 'open',
        note: noteText,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        const { error } = await supabase
          .from('reports')
          .update({ assigned_to: technicianName })
          .eq('id', reportId);
        if (error) {
          toast.error('Failed to assign technician', { description: error.message });
        } else {
          await supabase.from('status_events').insert(auditEvent);
          toast.success('Technician Assigned', { description: noteText });
        }
      } catch (err: any) {
        console.warn('Supabase persist error for assignReportTechnician:', err);
        toast.error('Network Error', { description: err.message || 'Could not reach server' });
      }
    },
    [currentUser, reports]
  );

  const addComment = useCallback(
    async (reportId: string, text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;
      const now = new Date().toISOString();
      const newComment: Comment = {
        id: crypto.randomUUID(),
        report_id: reportId,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role,
        text: trimmedText,
        created_at: now,
      };

      setComments((prev) => [...prev, newComment]);

      const report = reports.find((r) => r.id === reportId);
      let commentNotification: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        commentNotification = {
          id: crypto.randomUUID(),
          user_id: report.student_id,
          type: 'comment',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
          message: `${currentUser.name} (${roleLabel(currentUser.role)}) commented: "${trimmedText.slice(0, 50)}${trimmedText.length > 50 ? '...' : ''}"`,
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [commentNotification!, ...prev]);
      }

      try {
        const { error } = await supabase.from('comments').insert({
          id: newComment.id,
          report_id: newComment.report_id,
          author_id: newComment.author_id,
          author_name: newComment.author_name,
          author_role: newComment.author_role,
          text: newComment.text,
        });
        if (error) {
          toast.error('Failed to Post Comment', { description: error.message });
          setComments((prev) => prev.filter((c) => c.id !== newComment.id));
        } else {
          toast.success('Comment Posted');
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for addComment:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, reports]
  );

  const addInternalNote = useCallback(
    async (reportId: string, noteText: string) => {
      const trimmed = noteText.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const newNote: InternalNote = {
        id: crypto.randomUUID(),
        report_id: reportId,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role as 'staff' | 'admin',
        text: trimmed,
        created_at: now,
      };

      const report = reports.find((r) => r.id === reportId);
      const newEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: report?.status ?? 'open',
        note: `Internal note logged: "${trimmed.slice(0, 45)}${trimmed.length > 45 ? '...' : ''}"`,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      setInternalNotes((prev) => [newNote, ...prev]);
      setStatusEvents((prev) => [newEvent, ...prev]);

      try {
        const { error } = await supabase.from('internal_notes').insert({
          id: newNote.id,
          report_id: newNote.report_id,
          author_id: newNote.author_id,
          author_name: newNote.author_name,
          author_role: newNote.author_role,
          text: newNote.text,
        });
        if (error) {
          toast.error('Failed to Save Internal Note', { description: error.message });
        } else {
          await supabase.from('status_events').insert(newEvent);
          toast.success('Internal Note Saved');
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for addInternalNote:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, reports]
  );

  const updateInternalNote = useCallback(
    async (noteId: string, newText: string) => {
      const now = new Date().toISOString();

      setInternalNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, text: newText, updated_at: now } : n))
      );

      try {
        const { error } = await supabase
          .from('internal_notes')
          .update({ text: newText, updated_at: now })
          .eq('id', noteId);
        if (error) {
          toast.error('Failed to update note', { description: error.message });
        } else {
          toast.success('Internal Note Updated');
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for updateInternalNote:', err);
      }
    },
    []
  );

  const deleteInternalNote = useCallback(async (noteId: string) => {
    setInternalNotes((prev) => prev.filter((n) => n.id !== noteId));

    try {
      const { error } = await supabase.from('internal_notes').delete().eq('id', noteId);
      if (error) {
        toast.error('Failed to delete note', { description: error.message });
      } else {
        toast.success('Internal Note Deleted');
      }
    } catch (err: any) {
      console.warn('Supabase persist notice for deleteInternalNote:', err);
    }
  }, []);

  const getInternalNotesByReport = useCallback(
    (reportId: string) =>
      internalNotes
        .filter((n) => n.report_id === reportId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [internalNotes]
  );

  const confirmReport = useCallback(
    async (reportId: string) => {
      if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) {
        toast.info('Action Already Taken', { description: 'You have already verified or disputed this report.' });
        return;
      }

      try {
        const { data, error } = await supabase.rpc('rep_confirm_report', {
          p_report_id: reportId,
        });

        if (error) {
          toast.error('Verification Failed', { description: error.message });
        } else {
          toast.success('Report Verified by Rep', { description: '+10 priority verification score added.' });
          if (data && typeof data.new_score === 'number') {
            setReports((prev) =>
              prev.map((r) => (r.id === reportId ? { ...r, verification_score: data.new_score } : r))
            );
          }
        }
      } catch (err: any) {
        console.warn('RPC rep_confirm_report notice:', err);
        toast.error('Network Error', { description: err.message || 'Could not confirm report' });
      }
    },
    [hasRepConfirmed, hasRepDisputed]
  );

  const disputeReport = useCallback(
    async (reportId: string, reason: string) => {
      if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) {
        toast.info('Action Already Taken', { description: 'You have already verified or disputed this report.' });
        return;
      }

      if (reason.trim().length < 5) {
        toast.error('Reason Required', { description: 'Please provide at least 5 characters explaining the dispute.' });
        return;
      }

      try {
        const { data, error } = await supabase.rpc('rep_dispute_report', {
          p_report_id: reportId,
          p_reason: reason.trim(),
        });

        if (error) {
          toast.error('Dispute Failed', { description: error.message });
        } else {
          toast.success('Report Disputed', { description: '-5 points applied.' });
          if (data && typeof data.new_score === 'number') {
            setReports((prev) =>
              prev.map((r) => (r.id === reportId ? { ...r, verification_score: data.new_score } : r))
            );
          }
        }
      } catch (err: any) {
        console.warn('RPC rep_dispute_report notice:', err);
        toast.error('Network Error', { description: err.message || 'Could not dispute report' });
      }
    },
    [hasRepConfirmed, hasRepDisputed]
  );

  const markNotificationsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) =>
        !n.user_id || n.user_id === currentUser.id ? { ...n, read: true } : n
      )
    );

    if (currentUser.id && currentUser.id !== 'guest') {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', currentUser.id)
          .eq('read', false);
      } catch (err) {
        console.warn('Supabase persist notice for markNotificationsRead:', err);
      }
    }
  }, [currentUser.id]);

  const markNotificationAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      if (currentUser.id && currentUser.id !== 'guest') {
        try {
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
        } catch (err) {
          console.warn('Supabase persist notice for markNotificationAsRead:', err);
        }
      }
    },
    [currentUser.id]
  );

  const updateUserRole = useCallback(
    async (userId: string, role: Role) => {
      try {
        const { error } = await supabase.rpc('admin_update_user_role', {
          p_user_id: userId,
          p_role: role,
        });

        if (error) {
          toast.error('Failed to Update Role', { description: error.message });
        } else {
          toast.success('User Role Updated', { description: `Role successfully changed to ${role}.` });
          setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
          setCurrentUser((prev) => (prev.id === userId ? { ...prev, role } : prev));
        }
      } catch (err: any) {
        console.warn('RPC admin_update_user_role error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    []
  );

  const addLocation = useCallback(
    async (name: string, buildingType: BuildingType, hall?: string) => {
      const newLocation: Location = {
        id: crypto.randomUUID(),
        name: name.trim(),
        building_type: buildingType,
        hall: hall?.trim() || undefined,
      };
      setLocations((prev) => [...prev, newLocation]);

      try {
        const { error } = await supabase.from('locations').insert({
          id: newLocation.id,
          name: newLocation.name,
          building_type: newLocation.building_type,
          hall: newLocation.hall || null,
        });
        if (error) {
          toast.error('Failed to add location', { description: error.message });
        } else {
          toast.success('Location Added', { description: `${newLocation.name} saved.` });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for addLocation:', err);
      }
    },
    []
  );

  const updateLocation = useCallback(
    async (id: string, name: string, buildingType: BuildingType, hall?: string) => {
      const trimmedName = name.trim();
      const trimmedHall = hall?.trim();
      setLocations((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, name: trimmedName, building_type: buildingType, hall: trimmedHall } : l
        )
      );
      setReports((prev) =>
        prev.map((r) =>
          r.location_id === id ? { ...r, location_name: trimmedName } : r
        )
      );

      try {
        await supabase
          .from('locations')
          .update({ name: trimmedName, building_type: buildingType, hall: trimmedHall || null })
          .eq('id', id);
        await supabase
          .from('reports')
          .update({ location_name: trimmedName })
          .eq('location_id', id);
        toast.success('Location Updated');
      } catch (err: any) {
        console.warn('Supabase persist notice for updateLocation:', err);
        toast.error('Failed to update location', { description: err.message });
      }
    },
    []
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setLocations((prev) => prev.filter((l) => l.id !== id));

      try {
        const { error } = await supabase.from('locations').delete().eq('id', id);
        if (error) {
          toast.error('Failed to delete location', { description: error.message });
        } else {
          toast.success('Location Deleted');
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for deleteLocation:', err);
      }
    },
    []
  );

  const addCampusUnit = useCallback(
    async (name: string, category: CampusUnitCategory): Promise<CampusUnit> => {
      const trimmedName = name.trim();
      const newUnit: CampusUnit = {
        id: crypto.randomUUID(),
        name: trimmedName,
        category,
        created_at: new Date().toISOString(),
      };

      setCampusUnits((prev) =>
        [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name))
      );

      try {
        const { error } = await supabase.from('campus_units').insert({
          id: newUnit.id,
          name: newUnit.name,
          category: newUnit.category,
        });

        if (error) {
          setCampusUnits((prev) => prev.filter((u) => u.id !== newUnit.id));
          toast.error('Failed to add campus unit', { description: error.message });
          throw new Error(error.message);
        } else {
          // Keep locations table in sync
          const bType = newUnit.category === 'hall' ? 'residence' : newUnit.category === 'department' ? 'academic' : 'administrative';
          await supabase.from('locations').upsert({
            id: newUnit.id,
            name: newUnit.name,
            hall: newUnit.name,
            building_type: bType,
          });
          setLocations((prev) => [
            ...prev,
            { id: newUnit.id, name: newUnit.name, hall: newUnit.name, building_type: bType, created_at: new Date().toISOString() },
          ]);
          toast.success('Campus Unit Added', {
            description: `${trimmedName} added to ${category} registry.`,
          });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for addCampusUnit:', err);
        throw err;
      }

      return newUnit;
    },
    []
  );

  const updateCampusUnit = useCallback(
    async (id: string, name: string, category: CampusUnitCategory) => {
      const trimmedName = name.trim();
      let prevUnits: CampusUnit[] = [];
      setCampusUnits((prev) => {
        prevUnits = prev;
        return prev
          .map((u) => (u.id === id ? { ...u, name: trimmedName, category } : u))
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      try {
        const { error } = await supabase
          .from('campus_units')
          .update({ name: trimmedName, category })
          .eq('id', id);

        if (error) {
          if (prevUnits.length > 0) setCampusUnits(prevUnits);
          toast.error('Failed to update campus unit', { description: error.message });
          throw new Error(error.message);
        } else {
          const bType = category === 'hall' ? 'residence' : category === 'department' ? 'academic' : 'administrative';
          await supabase.from('locations').update({ name: trimmedName, hall: trimmedName, building_type: bType }).eq('id', id);
          setLocations((prev) =>
            prev.map((l) => (l.id === id ? { ...l, name: trimmedName, hall: trimmedName, building_type: bType } : l))
          );
          toast.success('Campus Unit Updated');
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for updateCampusUnit:', err);
        throw err;
      }
    },
    []
  );

  const deleteCampusUnit = useCallback(
    async (id: string) => {
      let target: CampusUnit | undefined;
      let prevUnits: CampusUnit[] = [];
      setCampusUnits((prev) => {
        prevUnits = prev;
        target = prev.find((u) => u.id === id);
        return prev.filter((u) => u.id !== id);
      });

      try {
        const { error } = await supabase.from('campus_units').delete().eq('id', id);
        if (error) {
          if (prevUnits.length > 0) setCampusUnits(prevUnits);
          toast.error('Failed to delete campus unit', { description: error.message });
          throw new Error(error.message);
        } else {
          await supabase.from('locations').delete().eq('id', id);
          setLocations((prev) => prev.filter((l) => l.id !== id));
          toast.success('Campus Unit Removed', {
            description: target ? `${target.name} removed from registry.` : 'Removed.',
          });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for deleteCampusUnit:', err);
        throw err;
      }
    },
    []
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
      name?: string,
      hall?: string,
      role?: Role,
      isSignUp?: boolean
    ): Promise<User> => {
      const normalized = email.trim().toLowerCase();

      // --- 1. REGISTRATION (SIGN UP) ---
      if (isSignUp) {
        // P0 Security Item 3: Public registrations are ALWAYS student.
        // No role inference from email text.
        const displayName = name?.trim() || normalized.split('@')[0];
        const assignedHall = hall?.trim() || 'Campus General';

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: {
            data: {
              name: displayName,
              hall_or_dept: assignedHall,
              role: 'student',
            },
          },
        });

        if (signUpError) {
          throw new Error(signUpError.message || 'Failed to register account.');
        }

        if (!authData.user) {
          throw new Error('Sign-up failed. No user was returned by authentication service.');
        }

        let activeUser: User | null = null;
        if (!authData.session) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: normalized,
            password,
          });
          if (!signInErr && signInData.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', signInData.user.id)
              .maybeSingle();
            if (profile) activeUser = dbProfileToUser(profile);
          }
        }

        if (!activeUser) {
          activeUser = {
            id: authData.user.id,
            name: displayName,
            email: normalized,
            hall_or_dept: assignedHall,
            role: 'student',
            is_banned: false,
          };
        }

        setCurrentUser(activeUser);
        setUsers((prev) => [activeUser!, ...prev.filter((u) => u.id !== activeUser!.id)]);
        await loadData(false);
        toast.success('Account Created', { description: 'Welcome to CampusFix!' });
        return activeUser;
      }

      // --- 2. AUTHENTICATION (SIGN IN) ---
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message || 'Invalid email or password. Please check your credentials.');
      }

      if (!authData.user) {
        throw new Error('Authentication succeeded but user identity is missing.');
      }

      const { data: dbProfile, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message || 'Database error while searching for account.');
      }

      if (!dbProfile) {
        throw new Error('User profile record not found in database.');
      }

      const user = dbProfileToUser(dbProfile);

      if (user.is_banned) {
        await supabase.auth.signOut();
        throw new Error(
          `Account suspended: ${user.ban_reason || 'Access has been revoked by administration.'}`
        );
      }

      setCurrentUser(user);
      setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);
      await loadData(false);
      toast.success('Signed In', { description: `Welcome back, ${user.name}!` });
      return user;
    },
    [loadData]
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
    if (typeof window !== 'undefined') {
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') || key.startsWith('campusfix_')) {
            localStorage.removeItem(key);
          }
        }
      } catch {}
    }
    setCurrentUser(DEFAULT_USER);
    setReports([]);
    setCorroborations([]);
    setStatusEvents([]);
    setComments([]);
    setInternalNotes([]);
    setVerificationSignals([]);
    setNotifications([]);
    setHallRepRequests([]);
    toast.info('Signed Out', { description: 'You have been signed out of your session.' });
  }, []);

  const onboardStaff = useCallback(
    async (
      name: string,
      email: string,
      department: string,
      password?: string
    ): Promise<User> => {
      const pw = password?.trim() || 'CampusStaff@2025!';
      const { data, error } = await supabase.rpc('admin_create_staff_user', {
        p_email: email.trim().toLowerCase(),
        p_password: pw,
        p_name: name.trim(),
        p_dept: department.trim(),
      });

      if (error) {
        toast.error('Failed to Onboard Staff', { description: error.message });
        throw new Error(error.message);
      }

      toast.success('Staff Account Created', {
        description: `Staff member ${name} (${department}) onboarded successfully.`,
      });

      const newStaff: User = {
        id: data?.id || crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        hall_or_dept: department.trim(),
        role: 'staff',
        requiresPasswordChange: true,
        onboardedAt: new Date().toISOString(),
        is_banned: false,
      };

      setUsers((prev) => [newStaff, ...prev]);
      return newStaff;
    },
    []
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      const { error: authErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authErr) {
        toast.error('Password Update Failed', { description: authErr.message });
        throw new Error(authErr.message);
      }

      try {
        await supabase
          .from('profiles')
          .update({ requires_password_change: false })
          .eq('id', currentUser.id);
      } catch (err) {
        console.warn('Notice updating requires_password_change flag:', err);
      }

      setCurrentUser((prev) => ({
        ...prev,
        requiresPasswordChange: false,
      }));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id ? { ...u, requiresPasswordChange: false } : u
        )
      );
      toast.success('Password Changed', { description: 'Your password was updated securely.' });
    },
    [currentUser.id]
  );

  // Hall Rep governance
  const submitHallRepRequest = useCallback(
    async (hall: string, statementOrRoom: string, maybeStatement?: string) => {
      const now = new Date().toISOString();
      const statement = (maybeStatement !== undefined ? maybeStatement : statementOrRoom).trim();
      const room = maybeStatement !== undefined ? statementOrRoom.trim() : undefined;
      const hallDisplay = room ? `${hall.trim()} (Room ${room})` : hall.trim();

      const newRequestId = crypto.randomUUID();
      const newRequest: HallRepRequest = {
        id: newRequestId,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_email: currentUser.email,
        hall: hallDisplay,
        statement: statement,
        status: 'pending',
        created_at: now,
        student_id: currentUser.id,
        student_name: currentUser.name,
        student_email: currentUser.email,
        hall_name: hallDisplay,
        room_number: room,
      };

      setHallRepRequests((prev) => [newRequest, ...prev]);

      const auditEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Student ${currentUser.name} applied for Hall Representative appointment (${hallDisplay})`,
        actor_role: 'student',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        const { error } = await supabase.from('hall_rep_requests').insert({
          id: newRequestId,
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_email: currentUser.email,
          hall: hallDisplay,
          statement: statement,
          status: 'pending',
        });
        if (error) {
          toast.error('Application Submission Failed', { description: error.message });
        } else {
          await supabase.from('status_events').insert(auditEvent);
          toast.success('Application Submitted', { description: 'Your application has been received by Administration.' });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for submitHallRepRequest:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser]
  );

  const reviewHallRepRequest = useCallback(
    async (requestId: string, approve: boolean, reason?: string) => {
      try {
        const { error } = await supabase.rpc('admin_review_rep_request', {
          p_request_id: requestId,
          p_approved: approve,
          p_reason: reason?.trim() || null,
        });

        if (error) {
          toast.error('Review Action Failed', { description: error.message });
        } else {
          toast.success(approve ? 'Request Approved' : 'Request Declined', {
            description: approve
              ? 'Candidate appointed as Hall Representative.'
              : 'Candidate notified of decline decision.',
          });
          const req = hallRepRequests.find((r) => r.id === requestId);
          const nextStatus = approve ? 'approved' : 'rejected';
          setHallRepRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? {
                    ...r,
                    status: nextStatus,
                    rejection_reason: approve ? undefined : reason,
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: currentUser.name,
                  }
                : r
            )
          );
          if (approve && req) {
            setUsers((prev) =>
              prev.map((u) => (u.id === req.user_id ? { ...u, role: 'rep' } : u))
            );
            if (currentUser.id === req.user_id) {
              setCurrentUser((prev) => ({ ...prev, role: 'rep' }));
            }
          }
        }
      } catch (err: any) {
        console.warn('RPC admin_review_rep_request error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, hallRepRequests]
  );

  const revokeHallRepStatus = useCallback(
    async (userId: string, reason?: string, requestId?: string) => {
      try {
        const { error } = await supabase.rpc('admin_revoke_rep_status', {
          p_user_id: userId,
          p_reason: reason?.trim() || null,
          p_request_id: requestId || null,
        });

        if (error) {
          toast.error('Action Failed', { description: error.message });
        } else {
          toast.success('Appointment Concluded', {
            description: 'User access returned to standard student level.',
          });
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: 'student' } : u))
          );
          if (currentUser.id === userId) {
            setCurrentUser((prev) => ({ ...prev, role: 'student' }));
          }
        }
      } catch (err: any) {
        console.warn('RPC admin_revoke_rep_status error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser.id]
  );

  // User Administration & Banning
  const banUser = useCallback(
    async (userId: string, reason: string) => {
      try {
        const { error } = await supabase.rpc('admin_ban_user', {
          p_user_id: userId,
          p_reason: reason.trim(),
        });

        if (error) {
          toast.error('Failed to Suspend User', { description: error.message });
        } else {
          toast.success('Account Suspended', { description: 'User account has been suspended.' });
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u))
          );
          if (currentUser.id === userId) {
            logout();
          }
        }
      } catch (err: any) {
        console.warn('RPC admin_ban_user error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser.id, logout]
  );

  const unbanUser = useCallback(
    async (userId: string) => {
      try {
        const { error } = await supabase.rpc('admin_unban_user', {
          p_user_id: userId,
        });

        if (error) {
          toast.error('Failed to Reinstate User', { description: error.message });
        } else {
          toast.success('Account Reinstated', { description: 'User suspension has been lifted.' });
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: undefined } : u))
          );
        }
      } catch (err: any) {
        console.warn('RPC admin_unban_user error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    []
  );

  const updateUserProfile = useCallback(
    async (
      userId: string,
      data: { name?: string; email?: string; hall_or_dept?: string; role?: Role }
    ) => {
      if (data.role) {
        await updateUserRole(userId, data.role);
      }

      const { role: _, ...profileFields } = data;
      if (Object.keys(profileFields).length > 0) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...profileFields } : u))
        );
        if (currentUser.id === userId) {
          setCurrentUser((prev) => ({ ...prev, ...profileFields }));
        }

        try {
          const { error } = await supabase.from('profiles').update(profileFields).eq('id', userId);
          if (error) {
            console.error('Supabase profile update error:', error);
            toast.error('Profile Update Failed', { description: error.message });
            throw new Error(error.message);
          }

          // If updating own profile, also keep Supabase Auth metadata in sync
          if (currentUser.id === userId) {
            const authMeta: Record<string, any> = {};
            if (profileFields.name) authMeta.name = profileFields.name;
            if (profileFields.hall_or_dept) authMeta.hall_or_dept = profileFields.hall_or_dept;
            if (Object.keys(authMeta).length > 0) {
              await supabase.auth.updateUser({ data: authMeta });
            }
          }

          toast.success('Profile Updated');
        } catch (err: any) {
          console.warn('Supabase persist notice for updateUserProfile:', err);
          throw err;
        }
      }
    },
    [currentUser.id, updateUserRole]
  );

  const deleteUserProfile = useCallback(
    async (userId: string) => {
      try {
        const { error } = await supabase.rpc('admin_delete_user', {
          p_user_id: userId,
        });

        if (error) {
          toast.error('Failed to Delete Account', { description: error.message });
        } else {
          toast.success('Account Deleted', { description: 'User account permanently removed.' });
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          if (currentUser.id === userId) {
            logout();
          }
        }
      } catch (err: any) {
        console.warn('RPC admin_delete_user error:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser.id, logout]
  );

  // Report Archiving
  const archiveReport = useCallback(
    async (reportId: string, reason: string) => {
      const now = new Date().toISOString();
      const report = reports.find((r) => r.id === reportId);

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, is_archived: true, archived_at: now, archived_reason: reason }
            : r
        )
      );

      let notif: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        notif = {
          id: crypto.randomUUID(),
          user_id: report.student_id,
          type: 'admin_notice',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 45)}...`,
          message: `Your report has been archived by administration: ${reason}`,
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [notif!, ...prev]);
      }

      const auditEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: report?.status || 'open',
        note: `Report archived by admin: "${reason}"`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        const { error } = await supabase
          .from('reports')
          .update({ is_archived: true, archived_at: now, archived_reason: reason })
          .eq('id', reportId);
        if (error) {
          toast.error('Failed to Archive Report', { description: error.message });
        } else {
          await supabase.from('status_events').insert(auditEvent);
          toast.success('Report Archived', { description: 'Report moved to archived records.' });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for archiveReport:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, reports]
  );

  const restoreReport = useCallback(
    async (reportId: string) => {
      const report = reports.find((r) => r.id === reportId);

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, is_archived: false, archived_at: undefined, archived_reason: undefined }
            : r
        )
      );

      const now = new Date().toISOString();
      let notif: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        notif = {
          id: crypto.randomUUID(),
          user_id: report.student_id,
          type: 'admin_notice',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 45)}...`,
          message: 'Your report has been unarchived and restored to active incident records.',
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [notif!, ...prev]);
      }

      const auditEvent: StatusEvent = {
        id: crypto.randomUUID(),
        report_id: reportId,
        status: report?.status || 'open',
        note: 'Report restored from archive by admin',
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        const { error } = await supabase
          .from('reports')
          .update({ is_archived: false, archived_at: null, archived_reason: null })
          .eq('id', reportId);
        if (error) {
          toast.error('Failed to Restore Report', { description: error.message });
        } else {
          await supabase.from('status_events').insert(auditEvent);
          toast.success('Report Restored', { description: 'Report returned to active feed.' });
        }
      } catch (err: any) {
        console.warn('Supabase persist notice for restoreReport:', err);
        toast.error('Network Error', { description: err.message });
      }
    },
    [currentUser, reports]
  );

  const value: DataContextValue = {
    currentUser,
    setCurrentUser,
    login,
    logout,
    onboardStaff,
    changePassword,
    users,
    reports,
    locations,
    corroborations,
    statusEvents,
    comments,
    internalNotes,
    notifications,
    verificationSignals,
    hallRepRequests,
    loading,
    error,
    addReport,
    corroborateReport,
    hasCorroborated,
    hasRepConfirmed,
    hasRepDisputed,
    updateReportStatus,
    updateReportPriority,
    assignReportTechnician,
    addComment,
    addInternalNote,
    updateInternalNote,
    deleteInternalNote,
    getInternalNotesByReport,
    confirmReport,
    disputeReport,
    markNotificationsRead,
    markNotificationAsRead,
    updateUserRole,
    addLocation,
    updateLocation,
    deleteLocation,
    campusUnits,
    addCampusUnit,
    updateCampusUnit,
    deleteCampusUnit,
    getReportById,
    getStatusEventsByReport,
    getCommentsByReport,
    getCorroborationsByReport,
    getVerificationSignals,
    getNotifications,
    getUnreadNotificationCount,

    // Hall Rep governance
    submitHallRepRequest,
    reviewHallRepRequest,
    revokeHallRepStatus,

    // User Administration & Banning
    banUser,
    unbanUser,
    updateUserProfile,
    deleteUserProfile,

    // Report Archiving
    archiveReport,
    restoreReport,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
