export interface Rent {
  id: number;
  siteId?: number;
  site?: {
    id: number;
    site: string;
  };
  boqId?: number;
  boq?: {
    id: number;
    boqNo: string;
  };
  rentalCategoryId?: number;
  rentalCategory?: {
    id: number;
    rentalCategory: string;
  };
  rentTypeId?: number;
  rentType?: {
    id: number;
    rentType: string;
  };
  owner?: string;
  pancardNo?: string;
  rentDay?: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
  depositAmount?: number;
  rentAmount?: number;
  bank?: string;
  branch?: string;
  accountNo?: string;
  accountName?: string;
  ifscCode?: string;
  momCopyUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentsResponse {
  data: Rent[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface RentFormData {
  siteId?: number;
  boqId?: number;
  rentalCategoryId?: number;
  rentTypeId?: number;
  owner?: string;
  pancardNo?: string;
  rentDay?: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
  depositAmount?: number;
  rentAmount?: number;
  bank?: string;
  branch?: string;
  accountNo?: string;
  accountName?: string;
  ifscCode?: string;
  momCopyUrl?: string;
}

// Dropdown option interfaces
export interface SiteOption {
  value: number;
  label: string;
}

export interface BoqOption {
  value: number;
  label: string;
}

export interface RentalCategoryOption {
  value: number;
  label: string;
}

export interface RentTypeOption {
  value: number;
  label: string;
}

// Rent day options (predefined list)
export const RENT_DAY_OPTIONS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '5', label: '5th' },
  { value: '6', label: '6th' },
  { value: '7', label: '7th' },
  { value: '8', label: '8th' },
  { value: '9', label: '9th' },
  { value: '10', label: '10th' },
  { value: '15', label: '15th' },
  { value: '20', label: '20th' },
  { value: '25', label: '25th' },
  { value: '30', label: '30th' },
  { value: '31', label: '31st' },
] as const;
