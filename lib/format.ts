import type { Category, BuildingType, ReportStatus, Role } from './types';

export function categoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    structural: 'Structural',
    sanitation: 'Sanitation',
    other: 'Other',
  };
  return labels[category];
}

export function buildingTypeLabel(type: BuildingType): string {
  const labels: Record<BuildingType, string> = {
    residence: 'Residence Halls',
    academic: 'Academic Blocks',
    administrative: 'Administrative',
    library: 'Library',
    sports: 'Sports Complex',
    dining: 'Dining',
  };
  return labels[type];
}

export function statusLabel(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };
  return labels[status];
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    student: 'Student',
    rep: 'Hall Rep',
    staff: 'Staff',
    admin: 'Administrator',
  };
  return labels[role];
}

export function daysSince(dateString: string): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 0;
  const now = new Date();

  // Compare calendar days by normalizing to midnight local time
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffCalendarDays = Math.round((startOfNow - startOfDate) / (1000 * 60 * 60 * 24));

  return Math.max(0, diffCalendarDays);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(dateString: string): string {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // If timestamp is in the future (due to slight clock skew) or less than 60s ago
  if (diffMs < 60 * 1000) return 'just now';

  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  const calendarDays = daysSince(dateString);
  if (calendarDays > 30) return formatDate(dateString);
  if (calendarDays > 0) return `${calendarDays}d ago`;

  return `${diffHr}h ago`;
}

export function formatReportToken(id: string): string {
  const num = id.replace(/\D/g, '') || id;
  return `#REP-${num.padStart(3, '0')}`;
}

export function formatWorkOrderToken(id: string): string {
  const num = id.replace(/\D/g, '') || id;
  return `#WO-${num.padStart(3, '0')}`;
}

export function matchTicketSearch(reportId: string, query: string): boolean {
  const cleanQ = query.trim().toLowerCase().replace(/[#\s-]/g, '');
  if (!cleanQ) return false;

  const reportToken = formatReportToken(reportId).toLowerCase().replace(/[#\s-]/g, '');
  const woToken = formatWorkOrderToken(reportId).toLowerCase().replace(/[#\s-]/g, '');
  const rawId = reportId.toLowerCase().replace(/[#\s-]/g, '');
  const digits = reportId.replace(/\D/g, '');
  const paddedDigits = digits.padStart(3, '0');

  return (
    reportToken.includes(cleanQ) ||
    woToken.includes(cleanQ) ||
    rawId.includes(cleanQ) ||
    paddedDigits.includes(cleanQ) ||
    (digits.length > 0 && digits === cleanQ)
  );
}


