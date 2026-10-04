export type Role = 'student' | 'rep' | 'staff' | 'admin';

export type ReportStatus = 'open' | 'in_progress' | 'resolved';

export type Category =
  | 'electrical'
  | 'plumbing'
  | 'structural'
  | 'sanitation'
  | 'other';

export type BuildingType =
  | 'residence'
  | 'academic'
  | 'administrative'
  | 'library'
  | 'sports'
  | 'dining';

export type HallRepRequestStatus = 'pending' | 'approved' | 'rejected' | 'stepped_down';

export interface HallRepRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  hall: string;
  statement: string;
  status: HallRepRequestStatus;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;

  // Compatibility aliases
  student_id?: string;
  student_name?: string;
  student_email?: string;
  hall_name?: string;
  room_number?: string;
  admin_notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  hall_or_dept: string;
  role: Role;
  requiresPasswordChange?: boolean;
  tempPasskey?: string;
  onboardedAt?: string;
  is_banned?: boolean;
  ban_reason?: string;
}

export interface Location {
  id: string;
  name: string;
  building_type: BuildingType;
}

export interface Report {
  id: string;
  student_id: string;
  student_name: string;
  location_id: string;
  location_name: string;
  category: Category;
  description: string;
  photo_url: string | null;
  status: ReportStatus;
  verification_score: number;
  is_archived?: boolean;
  archived_at?: string;
  archived_reason?: string;
  created_at: string;
}

export interface Corroboration {
  id: string;
  report_id: string;
  student_id: string;
  student_name: string;
  created_at: string;
}

export interface StatusEvent {
  id: string;
  report_id: string;
  status: ReportStatus;
  note: string;
  actor_role: Role;
  actor_name?: string;
  actor_id?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  report_id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  text: string;
  created_at: string;
}

export interface VerificationSignal {
  id: string;
  report_id: string;
  label: string;
  points: number;
}

export interface InternalNote {
  id: string;
  report_id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  text: string;
  created_at: string;
  updated_at?: string;
}

export const MAX_VERIFICATION_SCORE = 20;

export interface Notification {
  id: string;
  user_id?: string;
  type:
    | 'corroboration'
    | 'status_change'
    | 'rep_action'
    | 'comment'
    | 'rep_request'
    | 'admin_notice';
  report_id: string;
  report_description: string;
  message: string;
  created_at: string;
  read: boolean;
}

export interface DataContextValue {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  login: (
    email: string,
    password: string,
    name?: string,
    hall?: string,
    role?: Role,
    isSignUp?: boolean
  ) => Promise<User>;
  logout: () => Promise<void>;
  users: User[];
  reports: Report[];
  locations: Location[];
  corroborations: Corroboration[];
  statusEvents: StatusEvent[];
  comments: Comment[];
  internalNotes: InternalNote[];
  notifications: Notification[];
  verificationSignals: VerificationSignal[];
  hallRepRequests: HallRepRequest[];
  loading: boolean;
  error: string | null;
  addReport: (
    report: Omit<
      Report,
      'id' | 'verification_score' | 'created_at' | 'status' | 'student_id' | 'student_name' | 'is_archived' | 'archived_at' | 'archived_reason'
    >
  ) => Report;
  corroborateReport: (reportId: string) => void;
  hasCorroborated: (reportId: string) => boolean;
  hasRepConfirmed: (reportId: string) => boolean;
  hasRepDisputed: (reportId: string) => boolean;
  updateReportStatus: (
    reportId: string,
    newStatus: ReportStatus,
    note: string
  ) => void;
  addComment: (reportId: string, text: string) => void;
  addInternalNote: (reportId: string, note: string) => void;
  updateInternalNote: (noteId: string, newText: string) => void;
  deleteInternalNote: (noteId: string) => void;
  getInternalNotesByReport: (reportId: string) => InternalNote[];
  confirmReport: (reportId: string) => void;
  disputeReport: (reportId: string, reason: string) => void;
  markNotificationsRead: () => void;
  markNotificationAsRead: (id: string) => void;
  updateUserRole: (userId: string, role: Role) => void;
  onboardStaff: (
    name: string,
    email: string,
    department: string,
    tempPasskey: string
  ) => User;
  changePassword: (newPassword: string) => Promise<void>;
  addLocation: (name: string, buildingType: BuildingType) => void;
  updateLocation: (id: string, name: string, buildingType: BuildingType) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  getReportById: (id: string) => Report | undefined;
  getStatusEventsByReport: (reportId: string) => StatusEvent[];
  getCommentsByReport: (reportId: string) => Comment[];
  getCorroborationsByReport: (reportId: string) => Corroboration[];
  getVerificationSignals: (reportId: string) => VerificationSignal[];
  getNotifications: () => Notification[];
  getUnreadNotificationCount: () => number;

  // Hall Rep governance
  submitHallRepRequest: (
    hall: string,
    statementOrRoom: string,
    statement?: string
  ) => Promise<void>;
  reviewHallRepRequest: (
    requestId: string,
    approve: boolean,
    reason?: string
  ) => Promise<void>;
  revokeHallRepStatus: (
    userId: string,
    reason?: string,
    requestId?: string
  ) => Promise<void>;

  // User Administration & Banning
  banUser: (userId: string, reason: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
  updateUserProfile: (
    userId: string,
    data: { name?: string; email?: string; hall_or_dept?: string; role?: Role }
  ) => Promise<void>;
  deleteUserProfile: (userId: string) => Promise<void>;

  // Report Archiving
  archiveReport: (reportId: string, reason: string) => Promise<void>;
  restoreReport: (reportId: string) => Promise<void>;
}
