// Manpower Assignment types and interfaces

import { Site } from './sites';

// Manpower Supplier interface
export interface ManpowerSupplier {
  id: number;
  supplierName: string;
  contactName?: string | null;
  contactNo?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Extended Manpower interface with assignment fields
export interface Manpower {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  supplierId: number;
  manpowerSupplier?: ManpowerSupplier;
  
  // Contact and personal details
  dateOfBirth?: string | null;
  address?: string | null;
  location?: string | null;
  mobileNumber?: string | null;
  wage?: number | null;
  
  // Bank details
  bank?: string | null;
  branch?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  pfNo?: string | null;
  esicNo?: string | null;
  unaNo?: string | null;
  
  // Documents
  panNumber?: string | null;
  panDocumentUrl?: string | null;
  aadharNo?: string | null;
  aadharDocumentUrl?: string | null;
  voterIdNo?: string | null;
  voterIdDocumentUrl?: string | null;
  drivingLicenceNo?: string | null;
  drivingLicenceDocumentUrl?: string | null;
  bankDetailsDocumentUrl?: string | null;
  bankDetails?: string | null;
  watch?: boolean;
  
  // Assignment tracking fields (new)
  category?: string | null;
  skillSet?: string | null;
  minWage?: number | null;
  hours?: number | null;
  esic?: number | null;
  pf?: boolean;
  pt?: number | null;
  isAssigned?: boolean;
  currentSiteId?: number | null;
  currentSite?: Site | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Relations
  assignments?: ManpowerAssignment[];
}

// Manpower Assignment interface  
export interface ManpowerAssignment {
  id: number;
  siteId: number;
  manpowerId: number;
  assignedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  site?: Site;
  manpower?: Manpower;
}

// API Response types
export interface ManpowerResponse {
  data: Manpower[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
  };
}

export interface ManpowerAssignmentsResponse {
  data: ManpowerAssignment[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
  };
}

export interface ManpowerSuppliersResponse {
  data: ManpowerSupplier[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
  };
}

// Form data types
export interface ManpowerAssignmentFormData {
  siteId: number;
  manpowerIds: number[];
}

// Filter/Search types
export interface ManpowerFilters {
  manpowerSupplierId?: number | null;
  labourName?: string;
  category?: string;
  skillSet?: string;
  isAssigned?: boolean;
  currentSiteId?: number | null;
}

// Manpower assignment creation request
export interface CreateManpowerAssignmentRequest {
  siteId: number;
  manpowerIds: number[];
}

// Constants
export const MANPOWER_CATEGORIES = [
  'Skilled',
  'Unskilled',
  'Semi-skilled',
  'Supervisor',
  'Technician',
] as const;

export const SKILL_SETS = [
  'Mason',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Welder',
  'Painter',
  'Helper',
  'Labor',
  'Operator',
  'Driver',
] as const;
