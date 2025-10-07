// TypeScript interfaces for Attendance Reports module

export interface AttendanceReportFilters {
  siteIds: number[]; // Multiple sites selection
  month: string; // YYYY-MM format
  category?: string; // Optional filter
  skillSet?: string; // Optional filter
}

export interface DailyAttendance {
  date: string; // Date in YYYY-MM-DD format
  isPresent: boolean;
  isIdle: boolean;
  ot: number; // Overtime hours
}

export interface ManpowerAttendanceReport {
  manpowerId: number;
  manpowerName: string;
  supplierId: number;
  supplierName: string;
  category: string | null;
  skillSet: string | null;
  siteId: number;
  siteName: string;
  dailyAttendance: DailyAttendance[]; // One entry per day of the month
  totalPresent: number;
  totalAbsent: number;
  totalOT: number; // Total overtime hours
  totalIdle: number; // Total idle days
}

export interface SiteAttendanceGroup {
  siteId: number;
  siteName: string;
  manpowerRecords: ManpowerAttendanceReport[];
  siteTotals: {
    totalManpower: number;
    totalPresent: number;
    totalAbsent: number;
    totalOT: number;
    totalIdle: number;
  };
}

export interface AttendanceReportResponse {
  data: SiteAttendanceGroup[];
  filters: AttendanceReportFilters;
  totalRecords: number;
  grandTotals: {
    totalManpower: number;
    totalPresent: number;
    totalAbsent: number;
    totalOT: number;
    totalIdle: number;
  };
}

// Summary-only (no daily columns) types for Manpower Attendance Summary report
export interface ManpowerMonthlySummary {
  manpowerId: number;
  manpowerName: string;
  supplierId: number;
  supplierName: string;
  category: string | null;
  skillSet: string | null;
  siteId: number;
  siteName: string;
  totalPresent: number;
  totalAbsent: number;
  totalOT: number;
  totalIdle: number;
}

export interface SiteAttendanceSummaryGroup {
  siteId: number;
  siteName: string;
  manpowerSummaries: ManpowerMonthlySummary[];
  siteTotals: {
    totalManpower: number;
    totalPresent: number;
    totalAbsent: number;
    totalOT: number;
    totalIdle: number;
  };
}

export interface ManpowerAttendanceSummaryResponse {
  data: SiteAttendanceSummaryGroup[];
  filters: AttendanceReportFilters;
  totalRecords: number;
  grandTotals: {
    totalManpower: number;
    totalPresent: number;
    totalAbsent: number;
    totalOT: number;
    totalIdle: number;
  };
}

export interface SiteOption {
  id: number;
  site: string;
  shortName?: string;
}

export interface CategoryOption {
  id: number;
  categoryName: string;
}

export interface SkillSetOption {
  id: number;
  skillsetName: string;
}

export type ExportFormat = 'pdf' | 'excel';
