// Attendance-related TypeScript interfaces

export interface Attendance {
  id: number;
  date: string;
  siteId: number;
  manpowerId: number;
  isPresent: boolean;
  isIdle: boolean;
  ot?: string | null; // Prisma Decimal serialized as string
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceWithRelations extends Attendance {
  site?: {
    id: number;
    site: string;
  };
  manpower?: {
    id: number;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    category?: string | null;
    skillSet?: string | null;
  };
}

export interface AttendancesResponse {
  data: AttendanceWithRelations[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface SiteWithLastAttendance {
  id: number;
  site: string;
  shortName?: string | null;
  lastAttendanceDate?: string | null;
  assignedManpowerCount: number;
}

export interface SitesAttendanceResponse {
  data: SiteWithLastAttendance[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface ManpowerAttendanceItem {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  lastAttendance?: string | null; // Last attendance date for this manpower at this site
  ot: number;
  isPresent: boolean;
  isIdle: boolean;
  assignedAt?: string | null;
  isLocked?: boolean;
}

export interface CreateAttendanceRequest {
  date: string; // ISO date string
  siteId: number;
  attendances: {
    manpowerId: number;
    isPresent: boolean;
    isIdle: boolean;
    ot?: number;
  }[];
}

export interface EditAttendanceRequest {
  attendances: {
    id: number;
    isPresent: boolean;
    isIdle: boolean;
    ot?: number | null;
  }[];
}

export interface AttendanceForEdit extends AttendanceWithRelations {
  // Additional fields for display and editing
  manpowerFullName?: string;
  category?: string | null;
  skillSet?: string | null;
}

export interface EditAttendanceFilters {
  siteId?: number;
  fromDate?: string;
  toDate?: string;
}
