export interface Site {
  id: number;
  siteCode?: string | null;
  site: string;
  shortName?: string | null;
  companyId?: number | null;
  status: "Ongoing" | "Hold" | "Monitor";
  attachCopyUrl?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: number;
    companyName: string;
    shortName?: string | null;
  } | null;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
}

export interface SitesResponse {
  data: Site[];
  page: number; 
  perPage: number; 
  total: number; 
  totalPages: number; 
}

export interface CreateSiteData {
  siteCode?: string | null;
  site: string;
  shortName?: string | null;
  companyId?: number | null;
  status: "Ongoing" | "Hold" | "Monitor";
  attachCopyUrl?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
}

export interface UpdateSiteData {
  siteCode?: string | null;
  site?: string;
  shortName?: string | null;
  companyId?: number | null;
  status?: "Ongoing" | "Hold" | "Monitor";
  attachCopyUrl?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  panNo?: string | null;
  gstNo?: string | null;
  tanNo?: string | null;
  cinNo?: string | null;
}
