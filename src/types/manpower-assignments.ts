export interface AssignedManpowerItem {
  id: number; // manpower id
  firstName: string;
  middleName?: string | null;
  lastName: string;
  supplierId?: number;
  manpowerSupplier?: { id: number; supplierName: string } | null;
  mobileNumber?: string | null;
  // Assignment fields (stored on Manpower)
  category?: string | null;
  skillSet?: string | null;
  wage?: string | null; // Prisma Decimal serialized to string
  minWage?: string | null; // Prisma Decimal serialized to string
  esic?: string | null; // Prisma Decimal serialized to string
  pf?: boolean;
  pt?: string | null; // Prisma Decimal serialized to string
  hra?: string | null; // Prisma Decimal serialized to string
  mlwf?: string | null; // Prisma Decimal serialized to string
  isAssigned: boolean;
  currentSiteId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignManpowerRequestItem {
  manpowerId: number;
  category?: string | null;
  skillSet?: string | null;
  wage?: number | string | null;
  minWage?: number | string | null;
  esic?: number | string | null;
  pf?: boolean | null;
  pt?: number | string | null;
  hra?: number | string | null;
  mlwf?: number | string | null;
}

export interface AssignManpowerRequest {
  siteId: number;
  items: AssignManpowerRequestItem[];
}

export interface UpdateAssignmentsRequest {
  items: AssignManpowerRequestItem[]; // manpowerId + partial updates
}

export interface UnassignManpowerRequest {
  siteId?: number;
  manpowerIds: number[];
}

export interface AssignmentsResponse {
  data: AssignedManpowerItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
