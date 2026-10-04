// INVARIANT: All screens (Staff Dashboard, My Reports, Campus Feed, Rep Queue,
// Notifications, Admin Panel, Settings) read from and write to this single shared DataContext.
// Status changes, internal notes, and rep actions sync directly to Supabase with
// Realtime subscriptions so all screens update live from one Postgres database.
// This context operates strictly with live database data.
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { MAX_VERIFICATION_SCORE } from './types';
import type {
  User,
  Location,
  Report,
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
    tempPasskey: p.temp_passkey ?? undefined,
    onboardedAt: p.onboarded_at ?? undefined,
    is_banned: p.is_banned ?? false,
    ban_reason: p.ban_reason ?? undefined,
  };
}

function userToDbProfile(u: User): Record<string, any> {
  const profile: Record<string, any> = {
    id: u.id,
    name: u.name,
    email: u.email,
    hall_or_dept: u.hall_or_dept,
    role: u.role,
  };
  if (u.requiresPasswordChange) profile.requires_password_change = true;
  if (u.tempPasskey) profile.temp_passkey = u.tempPasskey;
  if (u.onboardedAt) profile.onboarded_at = u.onboardedAt;
  if (u.is_banned) profile.is_banned = true;
  if (u.ban_reason) profile.ban_reason = u.ban_reason;
  return profile;
}

async function safeInsertProfile(user: User): Promise<{ error: any }> {
  const payload: Record<string, any> = userToDbProfile(user);

  while (true) {
    const { error } = await supabase.from('profiles').insert(payload);
    if (!error) return { error: null };

    // Auto-heal if database table is missing an optional column
    const match = error.message?.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && match[1] in payload) {
      console.warn(`Column '${match[1]}' does not exist in public.profiles, retrying insert without it.`);
      delete payload[match[1]];
      continue;
    }

    return { error };
  }
}

async function safeUpsertProfile(user: User): Promise<{ error: any }> {
  const payload: Record<string, any> = userToDbProfile(user);

  while (true) {
    const { error } = await supabase.from('profiles').upsert(payload);
    if (!error) return { error: null };

    // Auto-heal if database table is missing an optional column
    const match = error.message?.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && match[1] in payload) {
      console.warn(`Column '${match[1]}' does not exist in public.profiles, retrying upsert without it.`);
      delete payload[match[1]];
      continue;
    }

    return { error };
  }
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [corroborations, setCorroborations] = useState<Corroboration[]>([]);
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [verificationSignals, setVerificationSignals] = useState<VerificationSignal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hallRepRequests, setHallRepRequests] = useState<HallRepRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load: Fetch live data strictly from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
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
        ] = await Promise.all([
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
        ]);

        if (!isMounted) return;

        // Verify that database tables exist
        if (reportsRes.error || locationsRes.error || profilesRes.error) {
          const errMsg = reportsRes.error?.message || locationsRes.error?.message || profilesRes.error?.message;
          console.warn('Supabase tables not initialized or query failed:', errMsg);
          setError('Database tables not initialized. Please run supabase/schema.sql in your Supabase SQL Editor.');
          setLoading(false);
          return;
        }

        // Populate state purely from database rows
        const loadedUsers = (profilesRes.data || []).map(dbProfileToUser);
        setUsers(loadedUsers);

        // Check active session from localStorage
        const savedUserId =
          typeof window !== 'undefined'
            ? localStorage.getItem('campusfix_user_id')
            : null;

        if (savedUserId) {
          const matched = loadedUsers.find((u) => u.id === savedUserId);
          if (matched) {
            if (!matched.is_banned) {
              setCurrentUser(matched);
            } else {
              localStorage.removeItem('campusfix_user_id');
              setCurrentUser(DEFAULT_USER);
            }
          }
        }


        setLocations((locationsRes.data || []) as Location[]);
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
        setLoading(false);
      } catch (err) {
        console.warn('Supabase connection error:', err);
        if (!isMounted) return;
        setError('Could not connect to Supabase. Please check your internet connection or project status.');
        setLoading(false);
      }
    }

    loadData();

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
            if (user.id === currentUser.id && user.is_banned) {
              logout();
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setUsers((prev) => prev.filter((u) => u.id !== oldId));
            if (oldId === currentUser.id) {
              logout();
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
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

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
        (s) => s.report_id === reportId && s.label.toLowerCase().includes('verified by rep')
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
    (input) => {
      const newId = `r${Date.now()}`;
      const now = new Date().toISOString();

      const initialSignals: VerificationSignal[] = [
        {
          id: `vs${Date.now()}-sub`,
          report_id: newId,
          label: '+1 report submitted',
          points: 1,
        },
      ];

      if (input.description.trim().length >= 100) {
        initialSignals.push({
          id: `vs${Date.now()}-desc`,
          report_id: newId,
          label: '+3 detailed description (over 100 characters)',
          points: 3,
        });
      }

      if (input.photo_url) {
        initialSignals.push({
          id: `vs${Date.now()}-photo`,
          report_id: newId,
          label: '+2 photo attached',
          points: 2,
        });
      }

      const initialScore = initialSignals.reduce((sum, s) => sum + s.points, 0);

      const newReport: Report = {
        id: newId,
        student_id: currentUser.id,
        student_name: currentUser.name,
        location_id: input.location_id,
        location_name: input.location_name,
        category: input.category,
        description: input.description,
        photo_url: input.photo_url,
        status: 'open',
        verification_score: Math.min(MAX_VERIFICATION_SCORE, Math.max(1, initialScore)),
        is_archived: false,
        created_at: now,
      };

      const newEvent: StatusEvent = {
        id: `se${Date.now()}`,
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

      (async () => {
        try {
          await supabase.from('reports').insert(newReport);
          await supabase.from('status_events').insert(newEvent);
          await supabase.from('verification_signals').insert(initialSignals);
        } catch (err) {
          console.warn('Supabase persist notice for addReport:', err);
        }
      })();

      return newReport;
    },
    [currentUser]
  );

  const corroborateReport = useCallback(
    (reportId: string) => {
      const report = reports.find((r) => r.id === reportId);
      if (!report) return;
      if (report.student_id === currentUser.id) return;
      if (hasCorroborated(reportId)) return;

      const now = new Date().toISOString();
      const newCorroboration: Corroboration = {
        id: `c${Date.now()}`,
        report_id: reportId,
        student_id: currentUser.id,
        student_name: currentUser.name,
        created_at: now,
      };

      const newScore = Math.min(MAX_VERIFICATION_SCORE, report.verification_score + 2);
      const newSignal: VerificationSignal = {
        id: `vs${Date.now()}`,
        report_id: reportId,
        label: `+2 corroborated by ${currentUser.name}`,
        points: 2,
      };

      const newNotification: Notification = {
        id: `n${Date.now()}`,
        user_id: report.student_id,
        type: 'corroboration',
        report_id: reportId,
        report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
        message: `${currentUser.name} corroborated your report`,
        created_at: now,
        read: false,
      };

      setCorroborations((prev) => [...prev, newCorroboration]);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, verification_score: newScore } : r))
      );
      setVerificationSignals((prev) => [...prev, newSignal]);
      setNotifications((prev) => [newNotification, ...prev]);

      (async () => {
        try {
          await supabase.from('corroborations').insert(newCorroboration);
          await supabase.from('reports').update({ verification_score: newScore }).eq('id', reportId);
          await supabase.from('verification_signals').insert(newSignal);
          await supabase.from('notifications').insert(newNotification);
        } catch (err) {
          console.warn('Supabase persist notice for corroborateReport:', err);
        }
      })();
    },
    [currentUser, hasCorroborated, reports]
  );

  const updateReportStatus = useCallback(
    (reportId: string, newStatus: ReportStatus, note: string) => {
      const now = new Date().toISOString();
      const newEvent: StatusEvent = {
        id: `se${Date.now()}`,
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
          id: `n${Date.now()}`,
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

      (async () => {
        try {
          await supabase.from('reports').update({ status: newStatus }).eq('id', reportId);
          await supabase.from('status_events').insert(newEvent);
          if (newNotification && report) {
            await supabase.from('notifications').insert(newNotification);
          }
        } catch (err) {
          console.warn('Supabase persist notice for updateReportStatus:', err);
        }
      })();
    },
    [currentUser, reports]
  );

  const addComment = useCallback(
    (reportId: string, text: string) => {
      const now = new Date().toISOString();
      const newComment: Comment = {
        id: `cm${Date.now()}`,
        report_id: reportId,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role,
        text,
        created_at: now,
      };

      setComments((prev) => [...prev, newComment]);

      const report = reports.find((r) => r.id === reportId);
      let commentNotification: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        commentNotification = {
          id: `n${Date.now()}`,
          user_id: report.student_id,
          type: 'comment',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
          message: `${currentUser.name} (${roleLabel(currentUser.role)}) commented: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [commentNotification!, ...prev]);
      }

      (async () => {
        try {
          await supabase.from('comments').insert(newComment);
          if (commentNotification) {
            await supabase.from('notifications').insert(commentNotification);
          }
        } catch (err) {
          console.warn('Supabase persist notice for addComment:', err);
        }
      })();
    },
    [currentUser, reports]
  );

  const addInternalNote = useCallback(
    (reportId: string, noteText: string) => {
      const now = new Date().toISOString();
      const newNote: InternalNote = {
        id: `in${Date.now()}`,
        report_id: reportId,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role,
        text: noteText,
        created_at: now,
      };

      const report = reports.find((r) => r.id === reportId);
      const newEvent: StatusEvent = {
        id: `se${Date.now()}`,
        report_id: reportId,
        status: report?.status ?? 'open',
        note: `Internal note logged: "${noteText.slice(0, 45)}${noteText.length > 45 ? '...' : ''}"`,
        actor_role: currentUser.role,
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      setInternalNotes((prev) => [newNote, ...prev]);
      setStatusEvents((prev) => [newEvent, ...prev]);

      (async () => {
        try {
          await supabase.from('internal_notes').insert(newNote);
          await supabase.from('status_events').insert(newEvent);
        } catch (err) {
          console.warn('Supabase persist notice for addInternalNote:', err);
        }
      })();
    },
    [currentUser, reports]
  );

  const updateInternalNote = useCallback(
    (noteId: string, newText: string) => {
      const now = new Date().toISOString();

      setInternalNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, text: newText, updated_at: now } : n))
      );

      (async () => {
        try {
          await supabase.from('internal_notes').update({ text: newText, updated_at: now }).eq('id', noteId);
        } catch (err) {
          console.warn('Supabase persist notice for updateInternalNote:', err);
        }
      })();
    },
    []
  );

  const deleteInternalNote = useCallback((noteId: string) => {
    setInternalNotes((prev) => prev.filter((n) => n.id !== noteId));

    (async () => {
      try {
        await supabase.from('internal_notes').delete().eq('id', noteId);
      } catch (err) {
        console.warn('Supabase persist notice for deleteInternalNote:', err);
      }
    })();
  }, []);

  const getInternalNotesByReport = useCallback(
    (reportId: string) =>
      internalNotes
        .filter((n) => n.report_id === reportId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [internalNotes]
  );

  const confirmReport = useCallback(
    (reportId: string) => {
      if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) return;
      const now = new Date().toISOString();
      const report = reports.find((r) => r.id === reportId);
      const currentStatus = report?.status ?? 'open';
      const newScore = Math.min(MAX_VERIFICATION_SCORE, (report?.verification_score ?? 0) + 10);

      const newSignal: VerificationSignal = {
        id: `vs${Date.now()}`,
        report_id: reportId,
        label: 'Verified by Rep',
        points: 10,
      };

      const auditEvent: StatusEvent = {
        id: `se${Date.now()}`,
        report_id: reportId,
        status: currentStatus,
        note: `Verified and confirmed on-site by Hall Rep ${currentUser.name}`,
        actor_role: 'rep',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      let newNotification: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        newNotification = {
          id: `n${Date.now()}`,
          user_id: report.student_id,
          type: 'rep_action',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
          message: `Hall Rep ${currentUser.name} verified and confirmed your report`,
          created_at: now,
          read: false,
        };
      }

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, verification_score: newScore } : r))
      );
      setVerificationSignals((prev) => [...prev, newSignal]);
      setStatusEvents((prev) => [auditEvent, ...prev]);
      if (newNotification) {
        setNotifications((prev) => [newNotification!, ...prev]);
      }

      (async () => {
        try {
          await supabase.from('reports').update({ verification_score: newScore }).eq('id', reportId);
          await supabase.from('verification_signals').insert(newSignal);
          await supabase.from('status_events').insert(auditEvent);
          if (newNotification) {
            await supabase.from('notifications').insert(newNotification);
          }
        } catch (err) {
          console.warn('Supabase persist notice for confirmReport:', err);
        }
      })();
    },
    [currentUser, hasRepConfirmed, hasRepDisputed, reports]
  );

  const disputeReport = useCallback(
    (reportId: string, reason: string) => {
      if (hasRepConfirmed(reportId) || hasRepDisputed(reportId)) return;
      const now = new Date().toISOString();
      const report = reports.find((r) => r.id === reportId);
      const currentStatus = report?.status ?? 'open';
      const newScore = Math.max(0, (report?.verification_score ?? 0) - 5);

      const auditEvent: StatusEvent = {
        id: `se${Date.now()}`,
        report_id: reportId,
        status: currentStatus,
        note: `Disputed by Hall Rep ${currentUser.name}: ${reason}`,
        actor_role: 'rep',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      let newNotification: Notification | null = null;
      if (report && currentUser.id !== report.student_id) {
        newNotification = {
          id: `n${Date.now()}`,
          user_id: report.student_id,
          type: 'rep_action',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 50)}...`,
          message: `Hall Rep ${currentUser.name} disputed your report: ${reason}`,
          created_at: now,
          read: false,
        };
      }

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, verification_score: newScore } : r))
      );
      setStatusEvents((prev) => [auditEvent, ...prev]);
      if (newNotification) {
        setNotifications((prev) => [newNotification!, ...prev]);
      }

      (async () => {
        try {
          await supabase.from('reports').update({ verification_score: newScore }).eq('id', reportId);
          await supabase.from('status_events').insert(auditEvent);
          if (newNotification) {
            await supabase.from('notifications').insert(newNotification);
          }
        } catch (err) {
          console.warn('Supabase persist notice for disputeReport:', err);
        }
      })();
    },
    [currentUser, hasRepConfirmed, hasRepDisputed, reports]
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) =>
        !n.user_id || n.user_id === currentUser.id ? { ...n, read: true } : n
      )
    );

    if (currentUser.id && currentUser.id !== 'guest') {
      (async () => {
        try {
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', currentUser.id)
            .eq('read', false);
        } catch (err) {
          console.warn('Supabase persist notice for markNotificationsRead:', err);
        }
      })();
    }
  }, [currentUser.id]);

  const markNotificationAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      if (currentUser.id && currentUser.id !== 'guest') {
        (async () => {
          try {
            await supabase
              .from('notifications')
              .update({ read: true })
              .eq('id', id);
          } catch (err) {
            console.warn('Supabase persist notice for markNotificationAsRead:', err);
          }
        })();
      }
    },
    [currentUser.id]
  );

  const updateUserRole = useCallback(
    (userId: string, role: Role) => {
      const prevUser = users.find((u) => u.id === userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      setCurrentUser((prev) => (prev.id === userId ? { ...prev, role } : prev));

      // If user was previously a rep and is demoted/changed, sync hall_rep_requests
      if (prevUser?.role === 'rep' && role !== 'rep') {
        const now = new Date().toISOString();
        const reason = 'Role changed by Administrator in User Directory.';
        setHallRepRequests((prev) =>
          prev.map((r) =>
            (r.user_id === userId || r.student_id === userId) && r.status === 'approved'
              ? {
                  ...r,
                  status: 'stepped_down' as HallRepRequestStatus,
                  rejection_reason: reason,
                  reviewed_at: now,
                  reviewed_by: currentUser.name || 'Administration',
                }
              : r
          )
        );

        (async () => {
          try {
            const { error: repSyncErr } = await supabase
              .from('hall_rep_requests')
              .update({
                status: 'stepped_down',
                rejection_reason: reason,
                reviewed_at: now,
                reviewed_by: currentUser.name || 'Administration',
              })
              .eq('user_id', userId)
              .eq('status', 'approved');

            if (repSyncErr) {
              await supabase
                .from('hall_rep_requests')
                .update({
                  status: 'rejected',
                  rejection_reason: reason,
                  reviewed_at: now,
                  reviewed_by: currentUser.name || 'Administration',
                })
                .eq('user_id', userId)
                .eq('status', 'approved');
            }
          } catch (err) {
            console.warn('Supabase sync notice for rep request on role change:', err);
          }
        })();
      }

      (async () => {
        try {
          await supabase.from('profiles').update({ role }).eq('id', userId);
        } catch (err) {
          console.warn('Supabase persist notice for updateUserRole:', err);
        }
      })();
    },
    [currentUser.name, users]
  );

  const addLocation = useCallback(
    (name: string, buildingType: BuildingType) => {
      const newLocation: Location = {
        id: `l${Date.now()}`,
        name,
        building_type: buildingType,
      };
      setLocations((prev) => [...prev, newLocation]);

      (async () => {
        try {
          await supabase.from('locations').insert(newLocation);
        } catch (err) {
          console.warn('Supabase persist notice for addLocation:', err);
        }
      })();
    },
    []
  );

  const updateLocation = useCallback(
    async (id: string, name: string, buildingType: BuildingType) => {
      const trimmedName = name.trim();
      setLocations((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, name: trimmedName, building_type: buildingType } : l
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
          .update({ name: trimmedName, building_type: buildingType })
          .eq('id', id);
        await supabase
          .from('reports')
          .update({ location_name: trimmedName })
          .eq('location_id', id);
      } catch (err) {
        console.warn('Supabase persist notice for updateLocation:', err);
      }
    },
    []
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setLocations((prev) => prev.filter((l) => l.id !== id));

      try {
        await supabase.from('locations').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase persist notice for deleteLocation:', err);
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
        let assignedRole: Role = role || 'student';
        if (normalized.includes('staff.')) assignedRole = 'staff';
        if (normalized.includes('admin.')) assignedRole = 'admin';

        const displayName = name?.trim() || normalized.split('@')[0];
        const assignedHall = hall?.trim() || 'Campus General';

        // Check if an account with this email already exists in public.profiles
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', normalized)
          .maybeSingle();

        if (existingProfile) {
          throw new Error(
            'An account with this email already exists. Please switch to "Sign In".'
          );
        }

        const newUser: User = {
          id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: displayName,
          email: normalized,
          hall_or_dept: assignedHall,
          role: assignedRole,
          tempPasskey: password,
          is_banned: false,
        };

        const { error: insertError } = await safeInsertProfile(newUser);

        if (insertError) {
          if (insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
            throw new Error('An account with this email already exists. Please switch to "Sign In".');
          }
          throw new Error(insertError.message || 'Failed to register account.');
        }

        setUsers((prev) => [
          newUser,
          ...prev.filter((u) => u.id !== newUser.id && u.email.toLowerCase() !== normalized),
        ]);
        setCurrentUser(newUser);

        if (typeof window !== 'undefined') {
          localStorage.setItem('campusfix_user_id', newUser.id);
        }

        return newUser;
      }

      // --- 2. AUTHENTICATION (SIGN IN) ---
      const { data: dbProfile, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', normalized)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message || 'Database error while searching for account.');
      }

      if (!dbProfile) {
        throw new Error(
          'Account not found. Please check your email or click "Create Account" to register.'
        );
      }

      if (dbProfile.temp_passkey && dbProfile.temp_passkey !== password) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      const user = dbProfileToUser(dbProfile);

      if (user.is_banned) {
        throw new Error(
          `Account suspended: ${user.ban_reason || 'Access has been revoked by administration.'}`
        );
      }

      // If temp_passkey was null (e.g. initial demo seed users), save the password
      if (!dbProfile.temp_passkey) {
        try {
          await supabase
            .from('profiles')
            .update({ temp_passkey: password })
            .eq('id', user.id);
        } catch (e) {}
      }

      setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);
      setCurrentUser(user);

      if (typeof window !== 'undefined') {
        localStorage.setItem('campusfix_user_id', user.id);
      }

      (async () => {
        try {
          const [notifsRes, repRes] = await Promise.all([
            supabase.from('notifications').select('*').order('created_at', { ascending: false }),
            supabase.from('hall_rep_requests').select('*').order('created_at', { ascending: false }),
          ]);
          if (notifsRes.data) {
            setNotifications(notifsRes.data as Notification[]);
          }
          if (repRes.data) {
            setHallRepRequests(
              (repRes.data as any[]).map((r) => {
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
          }
        } catch (e) {
          console.warn('Notice re-fetching on login:', e);
        }
      })();

      return user;
    },
    []
  );

  const logout = useCallback(async () => {
    setCurrentUser(DEFAULT_USER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('campusfix_user_id');
    }
  }, []);

  const onboardStaff = useCallback(
    (
      name: string,
      email: string,
      department: string,
      tempPasskey: string
    ): User => {
      const now = new Date().toISOString();
      const newStaff: User = {
        id: `u-staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        hall_or_dept: department.trim(),
        role: 'staff',
        requiresPasswordChange: true,
        tempPasskey: tempPasskey.trim(),
        onboardedAt: now,
        is_banned: false,
      };

      const auditEvent: StatusEvent = {
        id: `se-onboard-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Admin onboarded facilities staff member ${name} (${department}) with temporary passkey`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };

      setUsers((prev) => [newStaff, ...prev]);
      setStatusEvents((prev) => [auditEvent, ...prev]);

      (async () => {
        try {
          await safeUpsertProfile(newStaff);
          await supabase.from('status_events').insert(auditEvent);
        } catch (err) {
          console.warn('Supabase persist notice for onboardStaff:', err);
        }
      })();

      return newStaff;
    },
    [currentUser]
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          temp_passkey: newPassword,
          requires_password_change: false,
        })
        .eq('id', currentUser.id);

      if (error) {
        throw new Error(error.message || 'Failed to update password.');
      }

      setCurrentUser((prev) => ({
        ...prev,
        requiresPasswordChange: false,
        tempPasskey: newPassword,
      }));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, requiresPasswordChange: false, tempPasskey: newPassword }
            : u
        )
      );
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

      const newRequest: HallRepRequest = {
        id: `hrq${Date.now()}`,
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
        id: `se-rep-req-${Date.now()}`,
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
        const dbPayload = {
          id: newRequest.id,
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_email: currentUser.email,
          hall: hallDisplay,
          statement: statement,
          status: 'pending',
          created_at: now,
        };
        const { error: insertError } = await supabase.from('hall_rep_requests').insert(dbPayload);
        if (insertError) {
          console.warn('Supabase insert notice for submitHallRepRequest:', insertError);
        }
      } catch (err) {
        console.warn('Supabase persist notice for submitHallRepRequest:', err);
      }
    },
    [currentUser]
  );

  const reviewHallRepRequest = useCallback(
    async (requestId: string, approve: boolean, reason?: string) => {
      const req = hallRepRequests.find((r) => r.id === requestId);
      if (!req) return;

      const now = new Date().toISOString();
      const nextStatus = approve ? 'approved' : 'rejected';

      setHallRepRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: nextStatus,
                rejection_reason: approve ? undefined : reason,
                reviewed_at: now,
                reviewed_by: currentUser.name,
              }
            : r
        )
      );

      let newNotification: Notification;

      if (approve) {
        // Upgrade applicant to rep
        setUsers((prev) =>
          prev.map((u) => (u.id === req.user_id ? { ...u, role: 'rep' } : u))
        );
        if (currentUser.id === req.user_id) {
          setCurrentUser((prev) => ({ ...prev, role: 'rep' }));
        }

        newNotification = {
          id: `n${Date.now()}`,
          user_id: req.user_id,
          type: 'rep_request',
          report_id: 'SYSTEM_NOTIFICATION',
          report_description: `Hall Rep Appointment: ${req.hall}`,
          message: `Congratulations! Your application to serve as Hall Representative for ${req.hall} has been approved by the Administration.`,
          created_at: now,
          read: false,
        };

        const auditEvent: StatusEvent = {
          id: `se-rep-appr-${Date.now()}`,
          report_id: 'SYSTEM_AUDIT',
          status: 'open',
          note: `Admin approved ${req.user_name} as Hall Representative for ${req.hall}`,
          actor_role: 'admin',
          actor_name: currentUser.name,
          actor_id: currentUser.id,
          created_at: now,
        };
        setStatusEvents((prev) => [auditEvent, ...prev]);

        try {
          await supabase
            .from('hall_rep_requests')
            .update({
              status: 'approved',
              reviewed_at: now,
              reviewed_by: currentUser.name,
            })
            .eq('id', requestId);
          await supabase.from('profiles').update({ role: 'rep' }).eq('id', req.user_id);
          await supabase.from('notifications').insert(newNotification);
        } catch (err) {
          console.warn('Supabase persist notice for reviewHallRepRequest approve:', err);
        }
      } else {
        newNotification = {
          id: `n${Date.now()}`,
          user_id: req.user_id,
          type: 'rep_request',
          report_id: 'SYSTEM_NOTIFICATION',
          report_description: `Hall Rep Application: ${req.hall}`,
          message: `Your application for Hall Representative of ${req.hall} was declined: ${reason || 'Criteria not met at this time.'}`,
          created_at: now,
          read: false,
        };

        const auditEvent: StatusEvent = {
          id: `se-rep-decl-${Date.now()}`,
          report_id: 'SYSTEM_AUDIT',
          status: 'open',
          note: `Admin declined Hall Rep application for ${req.user_name} (${req.hall})`,
          actor_role: 'admin',
          actor_name: currentUser.name,
          actor_id: currentUser.id,
          created_at: now,
        };
        setStatusEvents((prev) => [auditEvent, ...prev]);

        try {
          await supabase
            .from('hall_rep_requests')
            .update({
              status: 'rejected',
              rejection_reason: reason || null,
              reviewed_at: now,
              reviewed_by: currentUser.name,
            })
            .eq('id', requestId);
          await supabase.from('notifications').insert(newNotification);
        } catch (err) {
          console.warn('Supabase persist notice for reviewHallRepRequest reject:', err);
        }
      }

      setNotifications((prev) => [newNotification, ...prev]);
    },
    [currentUser, hallRepRequests]
  );

  const revokeHallRepStatus = useCallback(
    async (userId: string, reason?: string, requestId?: string) => {
      const now = new Date().toISOString();
      const user = users.find((u) => u.id === userId);
      const isSelf = currentUser.id === userId;

      const targetReq = requestId
        ? hallRepRequests.find((r) => r.id === requestId)
        : hallRepRequests.find(
            (r) => (r.user_id === userId || r.student_id === userId) && r.status === 'approved'
          ) || hallRepRequests.find((r) => r.user_id === userId || r.student_id === userId);

      const hallName = targetReq?.hall || user?.hall_or_dept || 'Assigned Hall';
      const userName = user?.name || targetReq?.user_name || 'Representative';

      const stepDownReason =
        reason?.trim() ||
        (isSelf
          ? 'Candidate stepped down voluntarily as Hall Representative.'
          : 'Appointment concluded by University Administration.');

      // 1. Demote user profile in local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: 'student' } : u))
      );
      if (currentUser.id === userId) {
        setCurrentUser((prev) => ({ ...prev, role: 'student' }));
      }

      // 2. Mark corresponding hall rep request(s) as stepped_down / concluded
      setHallRepRequests((prev) =>
        prev.map((r) => {
          const matches = requestId
            ? r.id === requestId
            : r.user_id === userId || r.student_id === userId;
          if (matches) {
            return {
              ...r,
              status: 'stepped_down' as HallRepRequestStatus,
              rejection_reason: stepDownReason,
              reviewed_at: now,
              reviewed_by: isSelf ? 'Self (Resigned)' : currentUser.name || 'Administration',
            };
          }
          return r;
        })
      );

      // 3. System Notification for candidate
      const notif: Notification = {
        id: `n${Date.now()}`,
        user_id: userId,
        type: 'rep_request',
        report_id: 'SYSTEM_AUDIT',
        report_description: 'Hall Rep Appointment Status',
        message: isSelf
          ? `You have stepped down as Hall Representative for ${hallName}. Your account has returned to standard Student access.`
          : `Your Hall Representative appointment for ${hallName} has concluded. Your account has returned to standard Student access. Reason: ${stepDownReason}`,
        created_at: now,
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      // 4. System Audit Trail Event
      const auditEvent: StatusEvent = {
        id: `se-rep-rev-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: isSelf
          ? `${userName} stepped down voluntarily as Hall Representative for ${hallName}`
          : `Admin revoked Hall Representative appointment for ${userName} (${hallName}). Note: ${stepDownReason}`,
        actor_role: isSelf ? 'student' : 'admin',
        actor_name: currentUser.name || (isSelf ? 'Self' : 'Administration'),
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      // 5. Persist to Supabase
      try {
        await supabase.from('profiles').update({ role: 'student' }).eq('id', userId);
        await supabase.from('notifications').insert(notif);
        await supabase.from('status_events').insert(auditEvent);

        const updatePayload = {
          status: 'stepped_down',
          rejection_reason: stepDownReason,
          reviewed_at: now,
          reviewed_by: isSelf ? 'Self (Resigned)' : currentUser.name || 'Administration',
        };

        // Query directly by target request ID or user_id (no invalid columns)
        let updateReqQuery = supabase.from('hall_rep_requests').update(updatePayload);
        if (targetReq?.id) {
          updateReqQuery = updateReqQuery.eq('id', targetReq.id);
        } else {
          updateReqQuery = updateReqQuery.eq('user_id', userId);
        }

        const { error: repUpdateErr } = await updateReqQuery;

        if (repUpdateErr) {
          console.warn('stepped_down check constraint fallback notice:', repUpdateErr);
          // If remote Postgres check constraint hasn't been migrated, fallback to 'rejected'
          let fallbackQuery = supabase.from('hall_rep_requests').update({
            ...updatePayload,
            status: 'rejected',
          });
          if (targetReq?.id) {
            fallbackQuery = fallbackQuery.eq('id', targetReq.id);
          } else {
            fallbackQuery = fallbackQuery.eq('user_id', userId);
          }
          await fallbackQuery;
        }
      } catch (err) {
        console.warn('Supabase persist notice for revokeHallRepStatus:', err);
      }
    },
    [currentUser, hallRepRequests, users]
  );

  // User Administration & Banning
  const banUser = useCallback(
    async (userId: string, reason: string) => {
      const now = new Date().toISOString();
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u))
      );

      const notif: Notification = {
        id: `n${Date.now()}`,
        user_id: userId,
        type: 'admin_notice',
        report_id: 'SYSTEM_AUDIT',
        report_description: 'Account Suspension Notice',
        message: `Your account has been suspended by administration: ${reason}`,
        created_at: now,
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      const auditEvent: StatusEvent = {
        id: `se-ban-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Admin suspended account for ${user.name} (${user.email}). Reason: "${reason}"`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        await supabase
          .from('profiles')
          .update({ is_banned: true, ban_reason: reason })
          .eq('id', userId);
        await supabase.from('notifications').insert(notif);
        await supabase.from('status_events').insert(auditEvent);
      } catch (err) {
        console.warn('Supabase persist notice for banUser:', err);
      }

      if (currentUser.id === userId) {
        logout();
      }
    },
    [currentUser, logout, users]
  );

  const unbanUser = useCallback(
    async (userId: string) => {
      const now = new Date().toISOString();
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: undefined } : u))
      );

      const notif: Notification = {
        id: `n${Date.now()}`,
        user_id: userId,
        type: 'admin_notice',
        report_id: 'SYSTEM_AUDIT',
        report_description: 'Account Reactivation',
        message: 'Your account suspension has been lifted by administration.',
        created_at: now,
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      const auditEvent: StatusEvent = {
        id: `se-unban-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Admin reinstated account access for ${user.name}`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        await supabase
          .from('profiles')
          .update({ is_banned: false, ban_reason: null })
          .eq('id', userId);
        await supabase.from('notifications').insert(notif);
        await supabase.from('status_events').insert(auditEvent);
      } catch (err) {
        console.warn('Supabase persist notice for unbanUser:', err);
      }
    },
    [currentUser, users]
  );

  const updateUserProfile = useCallback(
    async (
      userId: string,
      data: { name?: string; email?: string; hall_or_dept?: string; role?: Role }
    ) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...data } : u))
      );
      if (currentUser.id === userId) {
        setCurrentUser((prev) => ({ ...prev, ...data }));
      }

      const now = new Date().toISOString();
      const auditEvent: StatusEvent = {
        id: `se-upd-usr-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Admin updated account profile for user ID ${userId}`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        await supabase.from('profiles').update(data).eq('id', userId);
        await supabase.from('status_events').insert(auditEvent);
      } catch (err) {
        console.warn('Supabase persist notice for updateUserProfile:', err);
      }
    },
    [currentUser]
  );

  const deleteUserProfile = useCallback(
    async (userId: string) => {
      const user = users.find((u) => u.id === userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));

      const now = new Date().toISOString();
      const auditEvent: StatusEvent = {
        id: `se-del-usr-${Date.now()}`,
        report_id: 'SYSTEM_AUDIT',
        status: 'open',
        note: `Admin deleted user profile ${user?.name || userId}`,
        actor_role: 'admin',
        actor_name: currentUser.name,
        actor_id: currentUser.id,
        created_at: now,
      };
      setStatusEvents((prev) => [auditEvent, ...prev]);

      try {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.from('status_events').insert(auditEvent);
      } catch (err) {
        console.warn('Supabase persist notice for deleteUserProfile:', err);
      }

      if (currentUser.id === userId) {
        logout();
      }
    },
    [currentUser, logout, users]
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
          id: `n${Date.now()}`,
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
        id: `se-arch-${Date.now()}`,
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
        await supabase
          .from('reports')
          .update({ is_archived: true, archived_at: now, archived_reason: reason })
          .eq('id', reportId);
        await supabase.from('status_events').insert(auditEvent);
        if (notif && report) {
          await supabase.from('notifications').insert(notif);
        }
      } catch (err) {
        console.warn('Supabase persist notice for archiveReport:', err);
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
          id: `n${Date.now()}`,
          user_id: report.student_id,
          type: 'admin_notice',
          report_id: reportId,
          report_description: `${report.location_name}: ${report.description.slice(0, 45)}...`,
          message: 'Your report has been unarchived and restored to the active incident feed.',
          created_at: now,
          read: false,
        };
        setNotifications((prev) => [notif!, ...prev]);
      }

      const auditEvent: StatusEvent = {
        id: `se-rest-${Date.now()}`,
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
        await supabase
          .from('reports')
          .update({ is_archived: false, archived_at: null, archived_reason: null })
          .eq('id', reportId);
        await supabase.from('status_events').insert(auditEvent);
        if (notif && report) {
          await supabase.from('notifications').insert(notif);
        }
      } catch (err) {
        console.warn('Supabase persist notice for restoreReport:', err);
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
