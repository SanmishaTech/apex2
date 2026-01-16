export interface Site {
  id: number;
  siteCode?: string | null;
  site: string;
  shortName?: string | null;
  companyId?: number | null;
  zoneId?: number | null;
  status: "ONGOING" | "HOLD" | "CLOSED" | "COMPLETED" | "MOBILIZATION_STAGE";

  attachCopyUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  completionPeriodInMonths?: number | null;
  extension1EndDate?: string | null;
  extension2EndDate?: string | null;
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
  zone?: {
    id: number;
    zoneName: string;
  } | null;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
  siteContactPersons?: Array<{
    id: number;
    siteId: number;
    name: string;
    contactNo: string;
    email: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  siteDeliveryAddresses?: Array<{
    id: number;
    siteId: number;
    addressLine1?: string | null;
    addressLine2?: string | null;
    stateId?: number | null;
    cityId?: number | null;
    pinCode?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface ContactPerson {
  id?: number;
  name: string;
  contactNo: string;
  email?: string | null;
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
  zoneId?: number | null;
  status: "ONGOING" | "HOLD" | "CLOSED" | "COMPLETED" | "MOBILIZATION_STAGE";
  attachCopyUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  completionPeriodInMonths?: number | null;
  extension1EndDate?: string | null;
  extension2EndDate?: string | null;
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
  zoneId?: number | null;
  status?: "ONGOING" | "HOLD" | "CLOSED" | "COMPLETED" | "MOBILIZATION_STAGE";
  attachCopyUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  completionPeriodInMonths?: number | null;
  extension1EndDate?: string | null;
  extension2EndDate?: string | null;
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
