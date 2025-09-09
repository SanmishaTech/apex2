export interface Company {
  id: number;
  companyName: string;
  shortName?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  logoUrl?: string | null;
  closed: boolean;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
  createdAt: string;
  updatedAt: string;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
}

export interface CompaniesResponse {
  data: Company[];
  page: number; 
  perPage: number; 
  total: number; 
  totalPages: number; 
}

export interface CreateCompanyData {
  companyName: string;
  shortName?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  logoUrl?: string | null;
  closed: boolean;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
}

export interface UpdateCompanyData {
  companyName?: string;
  shortName?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  logoUrl?: string | null;
  closed?: boolean;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
}
