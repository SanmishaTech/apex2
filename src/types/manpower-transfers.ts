export interface ManpowerTransferItem {
  id: number;
  manpowerId: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  manpowerSupplier?: { id: number; supplierName: string } | null;
  mobileNumber?: string | null;
  // Assignment details preserved during transfer
  category?: string | null;
  skillSet?: string | null;
  wage?: string | null; // Prisma Decimal serialized to string
  minWage?: string | null; // Prisma Decimal serialized to string
  hours?: string | null; // Prisma Decimal serialized to string
  esic?: string | null; // Prisma Decimal serialized to string
  pf?: boolean;
  pt?: string | null; // Prisma Decimal serialized to string
  hra?: string | null; // Prisma Decimal serialized to string
  mlwf?: string | null; // Prisma Decimal serialized to string
}

export interface ManpowerTransfer {
  id: number;
  challanNo: string;
  challanDate: string;
  fromSiteId: number;
  fromSite: { id: number; site: string };
  toSiteId: number;
  toSite: { id: number; site: string };
  status: 'Pending' | 'Accepted' | 'Rejected';
  challanCopyUrl?: string | null;
  approvedById?: number | null;
  approvedBy?: { id: number; name: string | null } | null;
  approvedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  transferItems: ManpowerTransferItem[];
}

export interface CreateManpowerTransferRequest {
  challanDate: string; // ISO date string
  fromSiteId: number;
  toSiteId: number;
  challanCopyUrl?: string | null;
  remarks?: string | null;
  manpowerIds: number[]; // Selected manpower IDs to transfer
}

export interface UpdateManpowerTransferRequest {
  status?: 'Pending' | 'Accepted' | 'Rejected';
  approvedById?: number | null;
  remarks?: string | null;
}

export interface ManpowerTransfersResponse {
  data: ManpowerTransfer[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Extended interface for assigned manpower (used in transfer form)
export interface AssignedManpowerForTransfer {
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
  hours?: string | null; // Prisma Decimal serialized to string
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

export interface AssignedManpowerResponse {
  data: AssignedManpowerForTransfer[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
